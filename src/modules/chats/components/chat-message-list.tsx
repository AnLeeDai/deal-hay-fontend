"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useTransition } from "react"
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
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
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
  MessageFooter,
  MessageGroup,
} from "@/components/ui/message"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserAvatar } from "@/components/user-avatar"
import { formatCurrency, formatDate } from "@/lib/format"
import { loadChatHistoryAction } from "@/modules/chats/actions"
import { ChatImageAttachment } from "@/modules/chats/components/chat-image-attachment"
import { ChatReplyPreview } from "@/modules/chats/components/chat-reply-preview"
import type { ChatHistoryResponse } from "@/api/chats/types"
import type { ChatMessage } from "@/types/chat"

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
      className="min-h-0 flex-1 overflow-hidden bg-muted/20"
    >
      <ScrollArea className="h-full min-h-0">
        <MessageGroup className="mx-auto w-full max-w-4xl gap-4 p-4 sm:p-6">
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

          {messages.map((message) => {
            const fromCurrentUser = message.sender.id === currentUserId
            const replyTo = message.reply_to
            return (
              <Message
                key={message.id}
                ref={(element) => {
                  if (element) messageElements.current.set(message.id, element)
                  else messageElements.current.delete(message.id)
                }}
                align={fromCurrentUser ? "end" : "start"}
                className={
                  highlightedMessageId === message.id
                    ? "rounded-xl bg-primary/10 ring-2 ring-primary/30"
                    : undefined
                }
                data-message-id={message.id}
                tabIndex={-1}
              >
                <MessageAvatar>
                  <UserAvatar
                    name={message.sender.name}
                    size="sm"
                    src={message.sender.avatar_url}
                  />
                </MessageAvatar>
                <MessageContent>
                  {replyTo ? (
                    <ChatReplyPreview
                      className={fromCurrentUser ? "self-end" : ""}
                      reply={replyTo}
                      onJump={() => jumpToMessage(replyTo.id)}
                    />
                  ) : null}
                  {message.product ? (
                    <Item
                      className="max-w-sm bg-card"
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
                  ) : null}

                  {message.body ? (
                    <Bubble
                      align={fromCurrentUser ? "end" : "start"}
                      variant={fromCurrentUser ? "default" : "secondary"}
                    >
                      <BubbleContent className="whitespace-pre-wrap">
                        {message.body}
                      </BubbleContent>
                    </Bubble>
                  ) : null}

                  {message.attachment ? (
                    <div className={fromCurrentUser ? "self-end" : ""}>
                      {message.attachment.type === "image" ? (
                        <ChatImageAttachment
                          messageId={message.id}
                          name={message.attachment.name}
                        />
                      ) : null}
                      <Button
                        nativeButton={false}
                        render={
                          <a
                            href={`/api/chat-attachments/${encodeURIComponent(message.id)}`}
                            rel="noreferrer"
                            target="_blank"
                          />
                        }
                        size="sm"
                        variant="outline"
                      >
                        {message.attachment.type === "image" ? (
                          <PaperclipIcon />
                        ) : (
                          <FileIcon />
                        )}
                        <span className="max-w-52 truncate">
                          {message.attachment.name}
                        </span>
                      </Button>
                    </div>
                  ) : null}

                  <MessageFooter>
                    <Button
                      aria-label={`Trả lời tin nhắn của ${message.sender.name}`}
                      className="mr-2 text-muted-foreground"
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => onReply(message)}
                    >
                      <ReplyIcon />
                      Trả lời
                    </Button>
                    {formatDate(message.created_at)}
                    {fromCurrentUser ? (
                      message.read_at ? (
                        <CheckCheckIcon
                          aria-label="Đã xem"
                          className="ml-1 text-primary"
                        />
                      ) : (
                        <CheckIcon aria-label="Đã gửi" className="ml-1" />
                      )
                    ) : null}
                  </MessageFooter>
                </MessageContent>
              </Message>
            )
          })}
          <div ref={bottomRef} aria-hidden="true" />
        </MessageGroup>
      </ScrollArea>
    </div>
  )
}
