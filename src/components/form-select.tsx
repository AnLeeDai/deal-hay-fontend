"use client"

import * as React from "react"

import { useFormField } from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type FormSelectOption = {
  label: string
  value: string
  disabled?: boolean
}

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
    <Select
      disabled={disabled}
      inputRef={inputRef}
      items={options}
      name={name}
      value={value || null}
      onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
    >
      <SelectTrigger
        aria-describedby={
          error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
        }
        aria-invalid={Boolean(error)}
        className="w-full"
        id={formItemId}
        onBlur={onBlur}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              disabled={option.disabled}
              value={option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
