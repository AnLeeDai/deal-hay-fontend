"use client"

import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

type FormSubmitButtonProps = {
  idleText: string
  pendingText?: string
  variant?:
    "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  className?: string
  pending?: boolean
  disabled?: boolean
}

export function FormSubmitButton({
  idleText,
  pendingText,
  variant,
  className,
  pending,
  disabled,
}: FormSubmitButtonProps) {
  const { pending: nativePending } = useFormStatus()
  const isPending = pending ?? nativePending

  return (
    <Button
      type="submit"
      variant={variant}
      disabled={disabled || isPending}
      className={className}
    >
      {isPending ? (pendingText ?? "Đang xử lý...") : idleText}
    </Button>
  )
}
