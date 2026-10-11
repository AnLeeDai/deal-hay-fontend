import { z } from "zod"

export const phoneNumberRegex = /^(\+84|0)[3-9]\d{8}$/
export const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).+$/

export const IMAGE_UPLOAD_MAX_BYTES = 30 * 1024 * 1024
export const PRODUCT_IMAGES_UPLOAD_MAX_BYTES = 32 * 1024 * 1024
export const CHAT_FILE_UPLOAD_MAX_BYTES = 3 * 1024 * 1024
const imageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
])
const chatAttachmentMimeTypes = new Set([
  ...imageMimeTypes,
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
])

export const IMAGE_UPLOAD_ACCEPT = [...imageMimeTypes].join(",")
export const CHAT_ATTACHMENT_ACCEPT = [...chatAttachmentMimeTypes].join(",")

export function fileSchema(message: string) {
  return z.custom<File>(
    (value) => value instanceof File && value.size > 0,
    message
  )
}

export function imageFileSchema(message: string) {
  return fileSchema(message).superRefine((file, context) => {
    if (!imageMimeTypes.has(file.type)) {
      context.addIssue({
        code: "custom",
        message: "Ảnh phải có định dạng JPG, PNG, GIF, WEBP, AVIF hoặc BMP.",
      })
    }
    if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
      context.addIssue({
        code: "custom",
        message: "Mỗi ảnh không được vượt quá 30 MB.",
      })
    }
  })
}

export function chatAttachmentFileSchema(message: string) {
  return fileSchema(message).superRefine((file, context) => {
    if (!chatAttachmentMimeTypes.has(file.type)) {
      context.addIssue({
        code: "custom",
        message: "Định dạng tệp đính kèm không được hỗ trợ.",
      })
    }
    const isImage = imageMimeTypes.has(file.type)
    const maxBytes = isImage
      ? IMAGE_UPLOAD_MAX_BYTES
      : CHAT_FILE_UPLOAD_MAX_BYTES
    if (file.size > maxBytes) {
      context.addIssue({
        code: "custom",
        message: isImage
          ? "Ảnh đính kèm không được vượt quá 30 MB."
          : "Tệp đính kèm không được vượt quá 3 MB.",
      })
    }
  })
}

export function optionalFileSchema(message: string) {
  return z
    .custom<File | undefined>(
      (value) =>
        value === undefined || (value instanceof File && value.size > 0),
      message
    )
    .optional()
}

export function requiredText(message: string) {
  return z.string().trim().min(1, message)
}
