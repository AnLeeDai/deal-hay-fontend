import { z } from "zod"

export const phoneNumberRegex = /^(\+84|0)[3-9]\d{8}$/
export const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).+$/

export function fileSchema(message: string) {
  return z.custom<File>(
    (value) => value instanceof File && value.size > 0,
    message
  )
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
