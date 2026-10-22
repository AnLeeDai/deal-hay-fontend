import { UploadError } from "@/lib/form-utils"
import { imageFileSchema } from "@/lib/validation"
import { requestImageTransformAction } from "@/modules/media/actions"
import type { ValidationErrors } from "@/types/common"
import type { ImagePurpose } from "@/types/media"

const transformMaxBytes = 20 * 1024
const preparedMaxBytes = 512 * 1024
const fallbackMaxBytes = 256 * 1024
const uploadFallback =
  "Không thể tải ảnh lên. Vui lòng kiểm tra kết nối và thử lại."

export type ImageUploadStage =
  "queued" | "preparing" | "uploading" | "processing" | "complete" | "error"

type FileProgress = {
  stage: ImageUploadStage
  percent: number
  loaded: number
  total: number
}

export type ImageUploadProgress = {
  percent: number
  completed: number
  files: (FileProgress & { name: string; field: string; index: number })[]
}

function concurrencyLimit(maximum: number) {
  let active = 0
  const waiting: (() => void)[] = []
  return async function <T>(action: () => Promise<T>): Promise<T> {
    if (active >= maximum) {
      await new Promise<void>((resolve) => waiting.push(resolve))
    } else {
      active++
    }
    try {
      return await action()
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }
}

// Keep decoded camera images out of PHP and avoid decoding several at once.
const prepareOneAtATime = concurrencyLimit(1)
const uploadTwoAtATime = concurrencyLimit(2)

async function decodeImage(file: File) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      }
    } catch {
      // Some browsers support a format in <img> but not ImageBitmap.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error("Cannot decode image"))
      image.src = url
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

async function prepareBrowserImage(
  file: File,
  purpose: ImagePurpose | "preview",
  field: string
): Promise<File> {
  let decoded: Awaited<ReturnType<typeof decodeImage>> | undefined
  let canvas: HTMLCanvasElement | undefined
  try {
    if (typeof document === "undefined") throw new Error("Canvas unavailable")
    decoded = await decodeImage(file)
    if (decoded.width < 1 || decoded.height < 1) {
      throw new Error("Invalid dimensions")
    }
    const maximum =
      purpose === "preview" ? 160 : purpose === "avatar" ? 640 : 1280
    const scale = Math.min(1, maximum / Math.max(decoded.width, decoded.height))
    canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(decoded.width * scale))
    canvas.height = Math.max(1, Math.round(decoded.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas unavailable")
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)
    const encode = (type: string, quality: number) =>
      new Promise<Blob>((resolve, reject) => {
        canvas!.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Cannot encode image")),
          type,
          quality
        )
      })

    let blob = await encode("image/webp", 0.82)
    if (blob.size > preparedMaxBytes) {
      // JPEG is also a fallback for browsers whose canvas only exports PNG.
      context.fillStyle = "#fff"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)
      blob = await encode("image/jpeg", 0.72)
    }
    if (blob.size < 1 || blob.size > preparedMaxBytes) {
      throw new Error("Prepared image too large")
    }
    const extension =
      blob.type === "image/webp"
        ? "webp"
        : blob.type === "image/jpeg"
          ? "jpg"
          : "png"
    return new File(
      [blob],
      `${file.name.replace(/\.[^/.]+$/, "") || "image"}.${extension}`,
      {
        type: blob.type,
        lastModified: file.lastModified,
      }
    )
  } catch {
    // A small source can still use the backend's format and memory checks.
    // Never silently send a large camera original when browser decoding fails.
    if (purpose !== "preview" && file.size <= fallbackMaxBytes) return file
    throw imageUploadError(
      field,
      file.name,
      "Trình duyệt không thể thu nhỏ ảnh này. Vui lòng đổi sang JPG, PNG, WEBP hoặc chọn ảnh dưới 256 KB."
    )
  } finally {
    decoded?.release()
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }
}

export function createImagePreview(
  file: File,
  signal?: AbortSignal
): Promise<Blob> {
  return prepareOneAtATime(async () => {
    if (signal?.aborted) throw new Error("Preview cancelled")
    return prepareBrowserImage(file, "preview", "image")
  })
}

function uploadImage(
  url: URL,
  token: string,
  file: File,
  field: string,
  fileName: string,
  onProgress?: (progress: FileProgress) => void,
  signal?: AbortSignal
): Promise<{ content: ArrayBuffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    const cleanup = () => signal?.removeEventListener("abort", abort)
    const fail = (error: Error) => {
      cleanup()
      reject(error)
    }
    if (signal?.aborted) {
      reject(new Error("Upload aborted"))
      return
    }

    xhr.open("POST", url.href)
    xhr.responseType = "arraybuffer"
    xhr.timeout = 120_000
    xhr.withCredentials = false
    xhr.setRequestHeader("Accept", "image/webp, application/json")
    xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress?.({
        stage: event.loaded >= event.total ? "processing" : "uploading",
        percent: Math.min(99, Math.floor((event.loaded / event.total) * 100)),
        loaded: event.loaded,
        total: event.total,
      })
    }
    xhr.onerror = () => fail(new Error(uploadFallback))
    xhr.ontimeout = () => fail(new Error(uploadFallback))
    xhr.onabort = () => fail(new Error("Upload aborted"))
    xhr.onload = () => {
      cleanup()
      if (xhr.responseURL && xhr.responseURL !== url.href) {
        reject(new Error("Unexpected upload redirect"))
        return
      }
      const contentType = xhr.getResponseHeader("content-type") ?? ""
      if (xhr.status < 200 || xhr.status >= 300) {
        let error: { message?: string; errors?: ValidationErrors } | undefined
        if (contentType.includes("application/json")) {
          try {
            error = JSON.parse(new TextDecoder().decode(xhr.response))
          } catch {
            // Preserve the upload error if an intermediary returned invalid JSON.
          }
        }
        reject(
          imageUploadError(
            field,
            fileName,
            error?.message || uploadFallback,
            error?.errors
          )
        )
        return
      }
      resolve({ content: xhr.response, contentType })
    }
    signal?.addEventListener("abort", abort, { once: true })
    const payload = new FormData()
    payload.set("image", file)
    xhr.send(payload)
  })
}

function imageUploadError(
  field: string,
  fileName: string,
  message: string,
  errors?: ValidationErrors
): UploadError {
  const messages = errors ? Object.values(errors).flat() : []
  const prefix = fileName ? `${fileName}: ` : ""
  return new UploadError(`${prefix}${message}`, {
    [field]: (messages.length > 0 ? messages : [message]).map(
      (detail) => `${prefix}${detail}`
    ),
  })
}

export async function transformImageFile(
  file: File,
  purpose: ImagePurpose,
  field = "image",
  options: {
    onProgress?: (progress: FileProgress) => void
    signal?: AbortSignal
  } = {}
): Promise<File> {
  const parsed = imageFileSchema("Ảnh không hợp lệ.").safeParse(file)
  if (!parsed.success) {
    throw imageUploadError(field, file.name, parsed.error.issues[0].message, {
      image: parsed.error.issues.map((issue) => issue.message),
    })
  }

  try {
    const prepared = await prepareOneAtATime(async () => {
      if (options.signal?.aborted) throw new Error("Upload aborted")
      options.onProgress?.({
        stage: "preparing",
        percent: 0,
        loaded: 0,
        total: file.size,
      })
      return prepareBrowserImage(file, purpose, field)
    })
    return await uploadTwoAtATime(async () => {
      if (options.signal?.aborted) throw new Error("Upload aborted")
      const grant = await requestImageTransformAction({
        size: prepared.size,
        purpose,
      })
      if (!grant.success || !grant.data) {
        throw imageUploadError(
          field,
          file.name,
          grant.message || uploadFallback,
          grant.errors
        )
      }

      const url = new URL(grant.data.url)
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw imageUploadError(field, file.name, uploadFallback)
      }

      options.onProgress?.({
        stage: "uploading",
        percent: 0,
        loaded: 0,
        total: prepared.size,
      })
      let uploaded = { loaded: 0, total: prepared.size }
      const { content, contentType } = await uploadImage(
        url,
        grant.data.token,
        prepared,
        field,
        file.name,
        (progress) => {
          uploaded = { loaded: progress.loaded, total: progress.total }
          options.onProgress?.(progress)
        },
        options.signal
      )
      const header = new TextDecoder("ascii").decode(content.slice(0, 12))
      if (
        contentType.split(";")[0].trim().toLowerCase() !== "image/webp" ||
        content.byteLength > transformMaxBytes ||
        header.slice(0, 4) !== "RIFF" ||
        header.slice(8, 12) !== "WEBP"
      ) {
        throw imageUploadError(
          field,
          file.name,
          "Phản hồi xử lý ảnh không hợp lệ."
        )
      }

      const name = `${file.name.replace(/\.[^/.]+$/, "") || "image"}.webp`
      const output = new File([content], name, {
        type: "image/webp",
        lastModified: file.lastModified,
      })
      options.onProgress?.({ stage: "complete", percent: 100, ...uploaded })
      return output
    })
  } catch (error) {
    options.onProgress?.({
      stage: "error",
      percent: 0,
      loaded: 0,
      total: file.size,
    })
    if (error instanceof UploadError) throw error
    throw imageUploadError(field, file.name, uploadFallback)
  }
}

export async function prepareImageUploads(
  formData: FormData,
  purpose: ImagePurpose,
  onProgress?: (progress: ImageUploadProgress) => void
): Promise<FormData> {
  const entries = Array.from(formData.entries())
  const images = entries.flatMap(([field, value], index) =>
    value instanceof File &&
    (purpose !== "chat" || value.type.startsWith("image/"))
      ? [{ field, file: value, index }]
      : []
  )
  const progress: ImageUploadProgress["files"] = images.map(
    ({ field, file, index }) => ({
      field,
      name: file.name,
      index,
      stage: "queued",
      percent: 0,
      loaded: 0,
      total: file.size,
    })
  )
  const controller = new AbortController()
  const publish = () => {
    if (controller.signal.aborted) return
    onProgress?.({
      percent:
        progress.length === 0
          ? 0
          : Math.floor(
              progress.reduce((sum, file) => sum + file.percent, 0) /
                progress.length
            ),
      completed: progress.filter((file) => file.stage === "complete").length,
      files: progress.map((file) => ({ ...file })),
    })
  }
  publish()
  const transformed = new Map<number, File>()
  let cursor = 0
  const worker = async () => {
    while (cursor < images.length && !controller.signal.aborted) {
      const position = cursor++
      const { field, file, index } = images[position]
      transformed.set(
        index,
        await transformImageFile(file, purpose, field, {
          signal: controller.signal,
          onProgress: (update) => {
            Object.assign(progress[position], update)
            publish()
          },
        })
      )
    }
  }
  try {
    await Promise.all(
      Array.from({ length: Math.min(2, images.length) }, worker)
    )
  } catch (error) {
    controller.abort()
    throw error
  }

  const payload = new FormData()
  for (const [index, [field, value]] of entries.entries()) {
    payload.append(field, transformed.get(index) ?? value)
  }
  return payload
}
