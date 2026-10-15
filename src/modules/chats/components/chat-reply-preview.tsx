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
  variant = "draft",
  outgoing = false,
}: {
  reply: ChatReply
  onCancel?: () => void
  onJump?: () => void
  className?: string
  variant?: "draft" | "message"
  outgoing?: boolean
}) {
  const content = (
    <>
      <span
        className={cn(
          "flex items-center gap-1 text-xs font-medium",
          variant === "draft" ? "text-primary" : "text-inherit"
        )}
      >
        {variant === "draft" ? (
          <ReplyIcon aria-hidden="true" className="size-3.5 shrink-0" />
        ) : null}
        <span className="truncate">
          {variant === "draft" ? "Đang trả lời " : ""}
          {reply.sender.name}
        </span>
      </span>
      <span
        className={cn(
          "line-clamp-2 text-xs leading-relaxed wrap-break-word",
          variant === "message" && outgoing
            ? "text-primary-foreground/80"
            : "text-muted-foreground"
        )}
      >
        {chatReplySummary(reply)}
      </span>
    </>
  )

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-2 border-l-2 p-2",
        variant === "draft"
          ? "max-w-sm rounded-lg border-primary/60 bg-muted/40"
          : outgoing
            ? "max-w-full rounded-md border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground"
            : "max-w-full rounded-md border-primary/40 bg-background/65 text-foreground/80",
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
