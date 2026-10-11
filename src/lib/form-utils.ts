import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form"

import type { ValidationErrors } from "@/types/common"

export function applyServerErrors<TFieldValues extends FieldValues>(
  errors: ValidationErrors | undefined,
  setError: UseFormSetError<TFieldValues>
): boolean {
  if (!errors) {
    return false
  }

  let hasErrors = false

  Object.entries(errors).forEach(([field, messages]) => {
    const message = messages[0]
    if (!message) {
      return
    }

    hasErrors = true
    setError(field as FieldPath<TFieldValues>, { type: "server", message })
  })

  return hasErrors
}

export function appendOptionalString(
  formData: FormData,
  key: string,
  value: string | undefined
): void {
  if (value && value.trim() !== "") {
    formData.set(key, value.trim())
  }
}

export function appendOptionalNumber(
  formData: FormData,
  key: string,
  value: number | undefined
): void {
  if (value !== undefined && Number.isFinite(value)) {
    formData.set(key, String(value))
  }
}

export function appendOptionalFile(
  formData: FormData,
  key: string,
  value: File | undefined
): void {
  if (value instanceof File && value.size > 0) {
    formData.set(key, value)
  }
}
