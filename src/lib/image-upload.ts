import { UploadError } from "@/lib/form-utils"
import {
  imageFileSchema,
  PREPARED_IMAGE_MAX_BYTES,
  PRODUCT_PREPARED_IMAGE_MAX_BYTES,
} from "@/lib/validation"
import {
  discardProductImageUploadsAction,
  requestProductImageUploadsAction,
} from "@/modules/media/actions"
import type { ValidationErrors } from "@/types/common"
import type { ImagePurpose } from "@/types/media"

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

// Share capacity across previews and forms so large camera images decode once
// at a time, even when several upload batches are active.
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
  field: string,
  signal?: AbortSignal
): Promise<File> {
  const outputMaxBytes =
    purpose === "product"
      ? PRODUCT_PREPARED_IMAGE_MAX_BYTES
      : PREPARED_IMAGE_MAX_BYTES
  let decoded: Awaited<ReturnType<typeof decodeImage>> | undefined
  let canvas: HTMLCanvasElement | undefined
  try {
    if (signal?.aborted) throw new DOMException("Upload aborted", "AbortError")
    if (typeof document === "undefined") throw new Error("Canvas unavailable")
    decoded = await decodeImage(file)
    if (signal?.aborted) throw new DOMException("Upload aborted", "AbortError")
    if (
      decoded.width < 1 ||
      decoded.height < 1 ||
      decoded.width > 8192 ||
      decoded.height > 8192 ||
      decoded.width * decoded.height > 32_000_000
    ) {
      throw new Error("Invalid dimensions")
    }
    const maximum =
      purpose === "preview" ? 160 : purpose === "avatar" ? 640 : 1280
    const scale = Math.min(1, maximum / Math.max(decoded.width, decoded.height))
    canvas = document.createElement("canvas")
    let width = Math.max(1, Math.round(decoded.width * scale))
    let height = Math.max(1, Math.round(decoded.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas unavailable")
    const encode = (quality: number) =>
      new Promise<Blob>((resolve, reject) => {
        canvas!.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Cannot encode image")),
          "image/webp",
          quality
        )
      })
    // Match the existing quality/size budget entirely on the user's device.
    // Canvas snapshots an animated source into one static, oriented frame and
    // writes a fresh file without the original EXIF/location metadata.
    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = width
      canvas.height = height
      context.drawImage(decoded.source, 0, 0, width, height)
      let encodedSize = 0
      for (const quality of [0.82, 0.68, 0.54]) {
        if (signal?.aborted)
          throw new DOMException("Upload aborted", "AbortError")
        const blob = await encode(quality)
        if (signal?.aborted)
          throw new DOMException("Upload aborted", "AbortError")
        if (blob.type !== "image/webp") {
          throw imageUploadError(
            field,
            file.name,
            "Trình duyệt chưa hỗ trợ xuất ảnh WEBP. Vui lòng cập nhật trình duyệt hoặc thử trình duyệt khác."
          )
        }
        if (blob.size < 1) throw new Error("Empty encoded image")
        encodedSize = blob.size
        if (blob.size <= outputMaxBytes) {
          return new File(
            [blob],
            `${file.name.replace(/\.[^/.]+$/, "") || "image"}.webp`,
            {
              type: "image/webp",
              lastModified: file.lastModified,
            }
          )
        }
      }
      if (width === 1 && height === 1) break
      const reduction = Math.max(
        0.5,
        Math.min(0.85, Math.sqrt(outputMaxBytes / encodedSize) * 0.95)
      )
      width = Math.max(1, Math.floor(width * reduction))
      height = Math.max(1, Math.floor(height * reduction))
    }
    throw imageUploadError(
      field,
      file.name,
      `Không thể nén ảnh xuống ${outputMaxBytes / 1024} KB trên thiết bị. Vui lòng chọn ảnh khác hoặc giảm kích thước ảnh trước khi tải lên.`
    )
  } catch (error) {
    if (
      error instanceof UploadError ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      throw error
    throw imageUploadError(
      field,
      file.name,
      "Trình duyệt không thể đọc hoặc nén ảnh này. Vui lòng đổi ảnh sang JPG, PNG hoặc WEBP, giảm kích thước ảnh rồi thử lại."
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
    const parsed = imageFileSchema("Ảnh không hợp lệ.").safeParse(file)
    if (!parsed.success)
      throw imageUploadError("image", file.name, parsed.error.issues[0].message)
    return prepareBrowserImage(file, "preview", "image", signal)
  })
}

function uploadImage(
  url: URL,
  file: File,
  field: string,
  fileName: string,
  onProgress?: (progress: FileProgress) => void,
  signal?: AbortSignal,
  stagedToken?: string
): Promise<void> {
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
    xhr.setRequestHeader("Accept", "application/json")
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
          Object.assign(
            imageUploadError(
              field,
              fileName,
              error?.message || uploadFallback,
              error?.errors
            ),
            { status: xhr.status }
          )
        )
        return
      }
      if (xhr.status !== 204 || (xhr.response?.byteLength ?? 0) !== 0) {
        reject(
          imageUploadError(
            field,
            fileName,
            "Máy chủ chưa xác nhận lưu ảnh. Vui lòng thử lại."
          )
        )
        return
      }
      resolve()
    }
    signal?.addEventListener("abort", abort, { once: true })
    const payload = new FormData()
    payload.set("image", file)
    if (stagedToken) payload.set("token", stagedToken)
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
      return prepareBrowserImage(file, purpose, field, options.signal)
    })
    options.onProgress?.({
      stage: "complete",
      percent: 100,
      loaded: prepared.size,
      total: prepared.size,
    })
    return prepared
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
  const transformed = new Map<number, File | string>()
  const stagedTokens: string[] = []
  const preparedProducts = new Map<number, File>()
  if (purpose === "product" && images.length > 0) {
    for (const [position, { field, file, index }] of images.entries()) {
      const parsed = imageFileSchema("Ảnh không hợp lệ.").safeParse(file)
      if (!parsed.success) {
        throw imageUploadError(field, file.name, parsed.error.issues[0].message)
      }
      let prepared: File
      try {
        prepared = await prepareOneAtATime(async () => {
          Object.assign(progress[position], { stage: "preparing", percent: 0 })
          publish()
          return prepareBrowserImage(file, purpose, field, controller.signal)
        })
      } catch (error) {
        Object.assign(progress[position], { stage: "error", percent: 0 })
        publish()
        throw error
      }
      preparedProducts.set(index, prepared)
      Object.assign(progress[position], {
        stage: "queued",
        percent: 0,
        total: prepared.size,
      })
      publish()
    }
    const sessions = await requestProductImageUploadsAction(
      images.map(({ index }) => {
        const file = preparedProducts.get(index)!
        return { size: file.size, content_type: file.type }
      })
    )
    if (!sessions.success || !sessions.data) {
      throw new UploadError(sessions.message || uploadFallback, sessions.errors)
    }
    stagedTokens.push(...sessions.data.tokens)
  }
  let cursor = 0
  const worker = async () => {
    while (cursor < images.length && !controller.signal.aborted) {
      const position = cursor++
      const { field, file, index } = images[position]
      const update = (update: FileProgress) => {
        Object.assign(progress[position], update)
        publish()
      }
      if (purpose === "product") {
        const prepared = preparedProducts.get(index)!
        const token = await uploadTwoAtATime(async () => {
          if (controller.signal.aborted) throw new Error("Upload aborted")
          update({
            stage: "uploading",
            percent: 0,
            loaded: 0,
            total: prepared.size,
          })
          // The same-origin proxy streams one small file, retains HttpOnly
          // authentication, and allows uploads outside the Server Action queue.
          const url = new URL(
            "/api/live/uploads/images/prepare",
            window.location.origin
          )
          for (let attempt = 0; ; attempt++) {
            try {
              await uploadImage(
                url,
                prepared,
                field,
                file.name,
                update,
                controller.signal,
                stagedTokens[position]
              )
              break
            } catch (error) {
              const retryable =
                error instanceof Error &&
                (error.message === uploadFallback ||
                  ("status" in error &&
                    [409, 429, 502, 503, 504].includes(Number(error.status))))
              if (!retryable || attempt >= 2 || controller.signal.aborted) {
                update({
                  stage: "error",
                  percent: 0,
                  loaded: 0,
                  total: prepared.size,
                })
                throw error
              }
              // Prepare is idempotent: retry the original token after a lost
              // response without writing a second image or consuming the token.
              update({
                stage: "processing",
                percent: 0,
                loaded: 0,
                total: prepared.size,
              })
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * (attempt + 1))
              )
            }
          }
          update({
            stage: "complete",
            percent: 100,
            loaded: prepared.size,
            total: prepared.size,
          })
          return stagedTokens[position]
        })
        transformed.set(index, token)
      } else {
        transformed.set(
          index,
          await transformImageFile(file, purpose, field, {
            signal: controller.signal,
            onProgress: update,
          })
        )
      }
    }
  }
  const workers = Array.from({ length: Math.min(2, images.length) }, worker)
  try {
    await Promise.all(workers)
  } catch (error) {
    controller.abort()
    // Settle every worker before cleaning completed and unused reservations.
    await Promise.allSettled(workers)
    if (stagedTokens.length > 0) {
      await discardProductImageUploadsAction(stagedTokens)
    }
    throw error
  }

  const payload = new FormData()
  for (const [index, [field, value]] of entries.entries()) {
    const output = transformed.get(index)
    if (purpose === "product" && typeof output === "string") {
      payload.append(
        field === "image" ? "primary_image_upload" : "gallery_image_uploads",
        output
      )
    } else {
      payload.append(field, output ?? value)
    }
  }
  return payload
}
