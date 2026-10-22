"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { FileIcon, ImageIcon, XIcon } from "lucide-react"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { cn } from "@/lib/utils"
import { createImagePreview } from "@/lib/image-upload"

type ObjectUrlState = {
  file: File
  url: string
}

function useImageObjectUrl(file: File): string | null {
  const [preview, setPreview] = useState<ObjectUrlState | null>(null)
  const isImage = file.type.startsWith("image/")

  useEffect(() => {
    if (!isImage) return

    const controller = new AbortController()
    let url: string | undefined
    void createImagePreview(file, controller.signal)
      .then((thumbnail) => {
        if (controller.signal.aborted) return
        url = URL.createObjectURL(thumbnail)
        setPreview({ file, url })
      })
      .catch(() => {
        // The file name and icon remain available if preview decoding fails.
      })

    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [file, isImage])

  return preview?.file === file ? preview.url : null
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`

  const units = ["KB", "MB", "GB"]
  let value = size / 1024
  let unit = units[0]

  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024
    unit = units[index]
  }

  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 1,
  }).format(value)} ${unit}`
}

export function SelectedFilePreview({
  file,
  compact = false,
  className,
  onRemove,
}: {
  file: File
  compact?: boolean
  className?: string
  onRemove?: () => void
}) {
  const isImage = file.type.startsWith("image/")
  const imageUrl = useImageObjectUrl(file)

  return (
    <Attachment
      className={cn(
        "w-full max-w-sm flex-nowrap",
        compact && "max-w-64",
        className
      )}
      size={compact ? "sm" : "default"}
    >
      <AttachmentMedia
        className={cn(compact ? "size-12" : "size-20")}
        variant={isImage ? "image" : "icon"}
      >
        {isImage ? (
          imageUrl ? (
            <Image
              fill
              unoptimized
              alt={`Xem trước ${file.name}`}
              className="object-cover"
              sizes={compact ? "48px" : "80px"}
              src={imageUrl}
            />
          ) : (
            <ImageIcon />
          )
        ) : (
          <FileIcon />
        )}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{file.name}</AttachmentTitle>
        <AttachmentDescription>
          {isImage ? "Ảnh đã chọn" : "Tệp đã chọn"} ·{" "}
          {formatFileSize(file.size)}
        </AttachmentDescription>
      </AttachmentContent>
      {onRemove ? (
        <AttachmentActions>
          <AttachmentAction
            aria-label={`Bỏ ${file.name}`}
            type="button"
            onClick={onRemove}
          >
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      ) : null}
    </Attachment>
  )
}
