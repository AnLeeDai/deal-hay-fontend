"use client"

import Link from "next/link"
import { Fragment, useEffect, useRef, useState, useTransition } from "react"
import {
  CheckCheckIcon,
  CheckIcon,
  FileIcon,
  LoaderCircleIcon,
  PaperclipIcon,
  ReplyIcon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/layout/empty-state"
import { MediaImage } from "@/components/media-image"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
} from "@/components/ui/message"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserAvatar } from "@/components/user-avatar"
import { formatCurrency, formatDate, formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { loadChatHistoryAction } from "@/modules/chats/actions"
import { ChatImageAttachment } from "@/modules/chats/components/chat-image-attachment"
import { ChatReplyPreview } from "@/modules/chats/components/chat-reply-preview"
import type { ChatHistoryResponse } from "@/api/chats/types"
import type { ChatMessage } from "@/types/chat"

const messageTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
})

function messageDay(message?: ChatMessage) {
  return message?.created_at && Number.isFinite(Date.parse(message.created_at))
    ? formatShortDate(message.created_at)
    : null
}

function continuesGroup(
  previous: ChatMessage | undefined,
  current: ChatMessage
) {
  if (
    !previous?.created_at ||
    !current.created_at ||
    previous.sender.id !== current.sender.id ||
    messageDay(previous) !== messageDay(current)
  ) {
    return false
  }
  const gap = Date.parse(current.created_at) - Date.parse(previous.created_at)
  return gap >= 0 && gap <= 5 * 60 * 1000
}

export function ChatMessageList({
  conversationSlug,
  currentUserId,
  messages,
  pagination,
  onOlderMessages,
  onReply,
}: {
  conversationSlug: string
  currentUserId: string
  messages: ChatMessage[]
  pagination: { has_more: boolean; next_cursor: string | null }
  onOlderMessages: (history: ChatHistoryResponse) => void
  onReply: (message: ChatMessage) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isLoadingOlder, startLoadingOlder] = useTransition()
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null)
  const messageElements = useRef(new Map<string, HTMLDivElement>())
  const highlightTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMessageId = messages.at(-1)?.id

  useEffect(
    () => () => {
      if (highlightTimeout.current) clearTimeout(highlightTimeout.current)
    },
    []
  )

  const jumpToMessage = (id: string) => {
    const element = messageElements.current.get(id)
    if (!element) {
      toast.info(
        "Tin nhắn gốc nằm trong lịch sử cũ. Bấm ‘Xem tin nhắn cũ hơn’ để tìm."
      )
      return
    }

    element.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    })
    element.focus({ preventScroll: true })
    setHighlightedMessageId(id)
    if (highlightTimeout.current) clearTimeout(highlightTimeout.current)
    highlightTimeout.current = setTimeout(() => {
      setHighlightedMessageId(null)
    }, 2000)
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [conversationSlug, lastMessageId])

  const loadOlder = () => {
    if (!pagination.next_cursor) return

    const viewport = containerRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    const previousHeight = viewport?.scrollHeight ?? 0
    const previousTop = viewport?.scrollTop ?? 0

    startLoadingOlder(async () => {
      const state = await loadChatHistoryAction(
        conversationSlug,
        pagination.next_cursor as string
      )
      if (!state.success || !state.data) {
        toast.error(state.message || "Không thể tải thêm tin nhắn.")
        return
      }

      onOlderMessages(state.data)
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (viewport) {
            viewport.scrollTop =
              previousTop + (viewport.scrollHeight - previousHeight)
          }
        })
      })
    })
  }

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-hidden bg-background"
    >
      <ScrollArea className="h-full min-h-0">
        <MessageGroup className="mx-auto w-full max-w-4xl gap-0 px-3 py-4 sm:px-6">
          {pagination.has_more ? (
            <Button
              className="self-center"
              disabled={isLoadingOlder}
              size="sm"
              variant="outline"
              onClick={loadOlder}
            >
              {isLoadingOlder ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : null}
              {isLoadingOlder ? "Đang tải..." : "Xem tin nhắn cũ hơn"}
            </Button>
          ) : null}

          {messages.length === 0 ? (
            <EmptyState
              title="Chưa có tin nhắn"
              description="Hãy gửi lời chào để bắt đầu cuộc trò chuyện."
            />
          ) : null}

          {messages.map((message, index) => {
            const fromCurrentUser = message.sender.id === currentUserId
            const replyTo = message.reply_to
            const previous = messages[index - 1]
            const next = messages[index + 1]
            const continuesPrevious = continuesGroup(previous, message)
            const continuesNext = next ? continuesGroup(message, next) : false
            const day = messageDay(message)
            const showDate = day && day !== messageDay(previous)
            const hasTimestamp =
              message.created_at &&
              Number.isFinite(Date.parse(message.created_at))
            const showBody =
              message.body &&
              !(
                message.attachment &&
                ["[Hình ảnh]", "[Video]", "[Tệp đính kèm]"].includes(
                  message.body
                )
              )
            return (
              <Fragment key={message.id}>
                {showDate ? (
                  <div className="flex justify-center pt-2 pb-3">
                    <span className="rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground">
                      {day === formatShortDate(new Date().toISOString())
                        ? "Hôm nay"
                        : day}
                    </span>
                  </div>
                ) : null}
                <Message
                  ref={(element) => {
                    if (element)
                      messageElements.current.set(message.id, element)
                    else messageElements.current.delete(message.id)
                  }}
                  align={fromCurrentUser ? "end" : "start"}
                  className={cn(
                    "items-end gap-2 rounded-xl transition-colors outline-none",
                    continuesPrevious ? "mt-1" : "mt-3",
                    highlightedMessageId === message.id &&
                      "bg-primary/10 ring-2 ring-primary/30"
                  )}
                  data-message-id={message.id}
                  tabIndex={-1}
                >
                  {!fromCurrentUser ? (
                    <div
                      className={cn(
                        "flex w-7 shrink-0 self-end",
                        !continuesNext && "mb-6"
                      )}
                    >
                      {!continuesNext ? (
                        <MessageAvatar className="min-w-7 bg-transparent">
                          <UserAvatar
                            className="size-7"
                            name={message.sender.name}
                            size="sm"
                            src={message.sender.avatar_url}
                          />
                        </MessageAvatar>
                      ) : null}
                    </div>
                  ) : null}
                  <MessageContent
                    className={cn(
                      "w-fit max-w-[calc(100%-2.25rem)] gap-1 sm:max-w-[75%]",
                      fromCurrentUser ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "flex max-w-full min-w-0 items-center gap-1",
                        fromCurrentUser && "flex-row-reverse"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-full min-w-0 overflow-hidden rounded-2xl",
                          fromCurrentUser
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/70 text-foreground",
                          continuesPrevious &&
                            (fromCurrentUser
                              ? "rounded-tr-md"
                              : "rounded-tl-md"),
                          continuesNext &&
                            (fromCurrentUser
                              ? "rounded-br-md"
                              : "rounded-bl-md")
                        )}
                        title={
                          hasTimestamp
                            ? formatDate(message.created_at)
                            : undefined
                        }
                      >
                        {replyTo ? (
                          <ChatReplyPreview
                            className="mx-1.5 mt-1.5 mb-0.5"
                            outgoing={fromCurrentUser}
                            reply={replyTo}
                            variant="message"
                            onJump={() => jumpToMessage(replyTo.id)}
                          />
                        ) : null}
                        {message.product ? (
                          <div className="p-1.5">
                            <Item
                              className="max-w-sm bg-card text-foreground"
                              render={
                                <Link
                                  href={`/shops/${message.product.shop_code}/products/${message.product.slug}`}
                                />
                              }
                              size="sm"
                              variant="outline"
                            >
                              <ItemMedia>
                                <MediaImage
                                  alt={message.product.name}
                                  className="size-12 rounded-md"
                                  fallbackLabel="Chưa có ảnh"
                                  sizes="48px"
                                  src={message.product.image_url}
                                />
                              </ItemMedia>
                              <ItemContent>
                                <ItemTitle>{message.product.name}</ItemTitle>
                                <ItemDescription>
                                  {formatCurrency(message.product.price)}
                                </ItemDescription>
                              </ItemContent>
                            </Item>
                          </div>
                        ) : null}

                        {showBody ? (
                          <div className="px-3.5 py-2 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
                            {message.body}
                          </div>
                        ) : null}

                        {message.attachment ? (
                          <div className="p-1.5 text-foreground">
                            {message.attachment.type === "image" ? (
                              <ChatImageAttachment
                                messageId={message.id}
                                name={message.attachment.name}
                              />
                            ) : null}
                            <a
                              href={`/api/chat-attachments/${encodeURIComponent(message.id)}`}
                              rel="noreferrer"
                              target="_blank"
                              className={buttonVariants({
                                className: "max-w-full",
                                size: "sm",
                                variant: "outline",
                              })}
                            >
                              {message.attachment.type === "image" ? (
                                <PaperclipIcon />
                              ) : (
                                <FileIcon />
                              )}
                              <span className="max-w-52 truncate">
                                {message.attachment.name}
                              </span>
                            </a>
                          </div>
                        ) : null}
                      </div>
                      <Button
                        aria-label={`Trả lời tin nhắn của ${message.sender.name}`}
                        className="shrink-0 rounded-full text-muted-foreground opacity-60 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/message:opacity-100 [@media(hover:hover)]:group-hover/message:opacity-100"
                        size="icon-sm"
                        title="Trả lời"
                        type="button"
                        variant="ghost"
                        onClick={() => onReply(message)}
                      >
                        <ReplyIcon />
                      </Button>
                    </div>
                    {!continuesNext ? (
                      <div className="flex items-center gap-1 px-1 pb-1 text-[10px] leading-4 text-muted-foreground">
                        <time
                          dateTime={message.created_at ?? undefined}
                          title={
                            hasTimestamp
                              ? formatDate(message.created_at)
                              : undefined
                          }
                        >
                          {hasTimestamp
                            ? messageTime.format(new Date(message.created_at!))
                            : "—"}
                        </time>
                        {fromCurrentUser ? (
                          message.read_at ? (
                            <CheckCheckIcon
                              aria-label="Đã xem"
                              className="size-3.5 text-muted-foreground"
                            />
                          ) : (
                            <CheckIcon
                              aria-label="Đã gửi"
                              className="size-3.5"
                            />
                          )
                        ) : null}
                      </div>
                    ) : null}
                  </MessageContent>
                </Message>
              </Fragment>
            )
          })}
          <div ref={bottomRef} aria-hidden="true" />
        </MessageGroup>
      </ScrollArea>
    </div>
  )
}
