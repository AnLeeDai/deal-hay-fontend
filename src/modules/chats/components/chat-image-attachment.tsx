"use client"

import { ImagePreview } from "@/components/image-preview"

export function ChatImageAttachment({
  messageId,
  name,
}: {
  messageId: string
  name: string
}) {
  const src = `/api/chat-attachments/${encodeURIComponent(messageId)}`

  return (
    <ImagePreview
      alt={name}
      className="mb-2"
      sizes="256px"
      src={src}
      thumbnailClassName="aspect-video w-64 max-w-full rounded-xl"
    />
  )
}
