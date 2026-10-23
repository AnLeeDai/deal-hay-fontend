"use client"

import * as React from "react"

import { AppSelect, type AppSelectOption } from "@/components/app-select"
import { useFormField } from "@/components/ui/form"

export type FormSelectOption = AppSelectOption

type FormSelectProps = {
  options: FormSelectOption[]
  value: string
  onValueChange: (value: string) => void
  onBlur?: React.FocusEventHandler<HTMLElement>
  inputRef?: React.Ref<HTMLInputElement>
  name?: string
  placeholder?: string
  disabled?: boolean
}

export function FormSelect({
  options,
  value,
  onValueChange,
  onBlur,
  inputRef,
  name,
  placeholder = "Chọn một tùy chọn",
  disabled,
}: FormSelectProps) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <AppSelect
      disabled={disabled}
      inputRef={inputRef}
      options={options}
      name={name}
      value={value}
      onValueChange={onValueChange}
      aria-describedby={
        error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
      }
      aria-invalid={Boolean(error)}
      id={formItemId}
      onBlur={onBlur}
      placeholder={placeholder}
    />
  )
}
