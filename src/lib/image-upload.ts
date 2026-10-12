import { UploadError } from "@/lib/form-utils"
import { imageFileSchema } from "@/lib/validation"
import { requestImageTransformAction } from "@/modules/media/actions"
import type { ValidationErrors } from "@/types/common"
import type { ImagePurpose } from "@/types/media"

const transformMaxBytes = 20 * 1024
const uploadFallback =
  "Không thể tải ảnh lên. Vui lòng kiểm tra kết nối và thử lại."

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
  field = "image"
): Promise<File> {
  const parsed = imageFileSchema("Ảnh không hợp lệ.").safeParse(file)
  if (!parsed.success) {
    throw imageUploadError(field, file.name, parsed.error.issues[0].message, {
      image: parsed.error.issues.map((issue) => issue.message),
    })
  }

  try {
    const grant = await requestImageTransformAction({
      size: file.size,
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

    const payload = new FormData()
    payload.set("image", file)
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "image/webp, application/json",
        Authorization: `Bearer ${grant.data.token}`,
      },
      body: payload,
      credentials: "omit",
      mode: "cors",
      redirect: "error",
      cache: "no-store",
    })
    const contentType = response.headers.get("content-type") ?? ""
    if (!response.ok) {
      const error = contentType.includes("application/json")
        ? ((await response.json()) as {
            message?: string
            errors?: ValidationErrors
          })
        : undefined
      throw imageUploadError(
        field,
        file.name,
        error?.message || uploadFallback,
        error?.errors
      )
    }

    const content = await response.arrayBuffer()
    const header = new TextDecoder("ascii").decode(content.slice(0, 12))
    if (
      contentType.split(";")[0].trim().toLowerCase() !== "image/webp" ||
      content.byteLength > transformMaxBytes ||
      header.slice(0, 4) !== "RIFF" ||
      header.slice(8, 12) !== "WEBP"
    ) {
      throw imageUploadError(field, file.name, "Phản hồi xử lý ảnh không hợp lệ.")
    }

    const name = `${file.name.replace(/\.[^/.]+$/, "") || "image"}.webp`
    return new File([content], name, {
      type: "image/webp",
      lastModified: file.lastModified,
    })
  } catch (error) {
    if (error instanceof UploadError) throw error
    throw imageUploadError(field, file.name, uploadFallback)
  }
}

export async function prepareImageUploads(
  formData: FormData,
  purpose: ImagePurpose
): Promise<FormData> {
  const payload = new FormData()
  for (const [field, value] of formData.entries()) {
    const isImage =
      value instanceof File &&
      (purpose !== "chat" || value.type.startsWith("image/"))
    payload.append(
      field,
      isImage ? await transformImageFile(value, purpose, field) : value
    )
  }
  return payload
}
