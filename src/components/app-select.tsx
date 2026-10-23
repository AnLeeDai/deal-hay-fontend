"use client"

import type { ComponentProps, FocusEventHandler, Ref } from "react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type AppSelectOption = {
  label: string
  value: string
  disabled?: boolean
}

type AppSelectProps = Pick<
  ComponentProps<typeof SelectTrigger>,
  "id" | "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid"
> & {
  options: readonly AppSelectOption[]
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string) => void
  onBlur?: FocusEventHandler<HTMLElement>
  inputRef?: Ref<HTMLInputElement>
  name?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  size?: "sm" | "default"
}

export function AppSelect({
  options,
  value,
  defaultValue,
  onValueChange,
  onBlur,
  inputRef,
  name,
  placeholder = "Chọn một tùy chọn",
  disabled,
  required,
  className,
  size,
  ...triggerProps
}: AppSelectProps) {
  return (
    <Select
      disabled={disabled}
      required={required}
      inputRef={inputRef}
      items={options}
      name={name}
      value={value === undefined ? undefined : value || null}
      defaultValue={defaultValue || null}
      onValueChange={(nextValue) => onValueChange?.(nextValue ?? "")}
    >
      <SelectTrigger
        className={cn("w-full min-w-0", className)}
        size={size}
        onBlur={onBlur}
        {...triggerProps}
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
