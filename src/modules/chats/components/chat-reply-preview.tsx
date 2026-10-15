"use client"

import { ReplyIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ChatReply } from "@/types/chat"

export function chatReplySummary(reply: ChatReply) {
  const parts: string[] = []
  if (reply.body.trim()) parts.push(reply.body.trim())
  if (reply.attachment) {
    const label =
      reply.attachment.type === "image"
        ? "Ảnh"
        : reply.attachment.type === "video"
          ? "Video"
          : "Tệp"
    parts.push(`${label}: ${reply.attachment.name}`)
  }
  if (reply.product) parts.push(`Sản phẩm: ${reply.product.name}`)
  return parts.join(" · ") || "Tin nhắn"
}

export function ChatReplyPreview({
  reply,
  onCancel,
  onJump,
  className,
}: {
  reply: ChatReply
  onCancel?: () => void
  onJump?: () => void
  className?: string
}) {
  const content = (
    <>
      <span className="flex items-center gap-1 text-xs font-medium text-primary">
        <ReplyIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">
          {onCancel ? "Đang trả lời" : "Trả lời"} {reply.sender.name}
        </span>
      </span>
      <span className="line-clamp-2 text-xs wrap-break-word text-muted-foreground">
        {chatReplySummary(reply)}
      </span>
    </>
  )

  return (
    <div
      className={cn(
        "flex max-w-sm min-w-0 items-start gap-2 rounded-md border-l-3 border-primary bg-muted/60 p-2",
        className
      )}
    >
      {onJump ? (
        <button
          aria-label={`Xem tin nhắn của ${reply.sender.name}`}
          className="flex min-w-0 flex-1 flex-col gap-1 rounded-sm text-left outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
          onClick={onJump}
        >
          {content}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-1" role="status">
          {content}
        </div>
      )}
      {onCancel ? (
        <Button
          aria-label="Hủy trả lời"
          className="-mt-1 -mr-1 shrink-0"
          size="icon-sm"
          type="button"
          variant="ghost"
          onClick={onCancel}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  )
}
