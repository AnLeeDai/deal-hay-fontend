"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ConnectionStatus } from "laravel-echo"
import {
  ArrowLeftIcon,
  CheckCheckIcon,
  LoaderCircleIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react"
import { toast } from "sonner"

import type {
  ChatHistoryResponse,
  ChatMessagesReadEvent,
  RealtimeConfig,
} from "@/api/chats/types"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import {
  heartbeatPresenceAction,
  markConversationReadAction,
} from "@/modules/chats/actions"
import { ChatComposer } from "@/modules/chats/components/chat-composer"
import { ChatConversationList } from "@/modules/chats/components/chat-conversation-list"
import { ChatMessageList } from "@/modules/chats/components/chat-message-list"
import { useChatRealtime } from "@/modules/chats/hooks/use-chat-realtime"
import type {
  ChatMessage,
  ConversationSummary,
  SelectedConversation,
} from "@/types/chat"

function RealtimeStatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <Badge variant="secondary">
        <WifiIcon /> Trực tiếp
      </Badge>
    )
  }

  if (status === "connecting" || status === "reconnecting") {
    return (
      <Badge variant="outline">
        <LoaderCircleIcon className="animate-spin" /> Đang kết nối
      </Badge>
    )
  }

  return (
    <Badge variant="destructive">
      <WifiOffIcon /> Mất kết nối
    </Badge>
  )
}

export function ChatsPageClient({
  conversations,
  selectedConversation,
  currentUserId,
  realtimeConfig,
}: {
  conversations: ConversationSummary[]
  selectedConversation: SelectedConversation | null
  currentUserId: string
  realtimeConfig: RealtimeConfig
}) {
  const router = useRouter()
  const [conversationItems, setConversationItems] = useState(conversations)
  const [activeConversation, setActiveConversation] =
    useState(selectedConversation)
  const [readPending, startReadTransition] = useTransition()
  const socketIdRef = useRef<string | undefined>(undefined)
  const syncedConversationId = useRef<string | null>(null)
  const receivedMessageIds = useRef(
    new Set(selectedConversation?.messages.map((message) => message.id) ?? [])
  )

  const markAsRead = useCallback(
    (showConfirmation = false, socketId?: string) => {
      if (!activeConversation) return

      startReadTransition(async () => {
        const state = await markConversationReadAction(
          activeConversation.slug,
          socketId
        )
        if (!state.success) {
          if (showConfirmation) toast.error(state.message)
          return
        }

        setConversationItems((current) =>
          current.map((conversation) =>
            conversation.id === activeConversation.id
              ? { ...conversation, unread_count: 0 }
              : conversation
          )
        )
        setActiveConversation((current) =>
          current ? { ...current, unread_count: 0 } : current
        )
        if (showConfirmation) toast.success(state.message)
      })
    },
    [activeConversation]
  )

  const handleIncomingMessage = useCallback(
    (message: ChatMessage) => {
      if (receivedMessageIds.current.has(message.id)) return
      receivedMessageIds.current.add(message.id)

      const knownConversation = conversationItems.some(
        (conversation) => conversation.id === message.conversation_id
      )
      if (!knownConversation) {
        router.refresh()
        return
      }

      const isActive = activeConversation?.id === message.conversation_id
      setConversationItems((current) => {
        const updated = current.find(
          (conversation) => conversation.id === message.conversation_id
        )
        if (!updated) return current

        const nextConversation = {
          ...updated,
          last_message: message.body,
          updated_at: message.created_at,
          unread_count: isActive ? 0 : updated.unread_count + 1,
        }

        return [
          nextConversation,
          ...current.filter(
            (conversation) => conversation.id !== message.conversation_id
          ),
        ]
      })

      if (!isActive) return
      setActiveConversation((current) =>
        current
          ? {
              ...current,
              last_message: message.body,
              updated_at: message.created_at,
              unread_count: 0,
              messages: [...current.messages, message],
            }
          : current
      )

      if (document.visibilityState === "visible") {
        markAsRead(false, socketIdRef.current)
      }
    },
    [activeConversation, conversationItems, markAsRead, router]
  )

  const handleMessagesRead = useCallback(
    (event: ChatMessagesReadEvent) => {
      if (event.conversation_id !== activeConversation?.id) return
      const messageIds = new Set(event.message_ids)
      setActiveConversation((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((message) =>
                messageIds.has(message.id)
                  ? { ...message, read_at: event.read_at }
                  : message
              ),
            }
          : current
      )
    },
    [activeConversation?.id]
  )

  const handlePresenceChange = useCallback(
    (isOnline: boolean) => {
      if (!activeConversation) return
      setActiveConversation((current) =>
        current
          ? {
              ...current,
              counterpart: { ...current.counterpart, is_online: isOnline },
            }
          : current
      )
      setConversationItems((current) =>
        current.map((conversation) =>
          conversation.id === activeConversation.id
            ? {
                ...conversation,
                counterpart: {
                  ...conversation.counterpart,
                  is_online: isOnline,
                },
              }
            : conversation
        )
      )
    },
    [activeConversation]
  )

  const handleReconnect = useCallback(() => router.refresh(), [router])
  const { socketId, status } = useChatRealtime({
    config: realtimeConfig,
    currentUserId,
    selectedConversationId: activeConversation?.id,
    counterpartId: activeConversation?.counterpart.id,
    onMessage: handleIncomingMessage,
    onMessagesRead: handleMessagesRead,
    onPresenceChange: handlePresenceChange,
    onReconnect: handleReconnect,
  })

  useEffect(() => {
    socketIdRef.current = socketId
  }, [socketId])

  useEffect(() => {
    const conversationId = activeConversation?.id
    if (
      !conversationId ||
      syncedConversationId.current === conversationId ||
      document.visibilityState !== "visible"
    ) {
      return
    }

    syncedConversationId.current = conversationId
    markAsRead(false, socketId)
  }, [activeConversation?.id, markAsRead, socketId])

  const handleSent = useCallback(
    (message: ChatMessage) => {
      if (!activeConversation || receivedMessageIds.current.has(message.id)) {
        return
      }
      receivedMessageIds.current.add(message.id)
      setActiveConversation((current) =>
        current
          ? {
              ...current,
              last_message: message.body,
              updated_at: message.created_at,
              messages: [...current.messages, message],
            }
          : current
      )
      setConversationItems((current) => {
        const updated = current.find(
          (conversation) => conversation.id === message.conversation_id
        )
        if (!updated) return current
        return [
          {
            ...updated,
            last_message: message.body,
            updated_at: message.created_at,
          },
          ...current.filter(
            (conversation) => conversation.id !== message.conversation_id
          ),
        ]
      })
    },
    [activeConversation]
  )

  const handleOlderMessages = useCallback((history: ChatHistoryResponse) => {
    setActiveConversation((current) => {
      if (!current) return current
      const existingIds = new Set(current.messages.map((message) => message.id))
      return {
        ...current,
        messages: [
          ...history.messages.filter((message) => !existingIds.has(message.id)),
          ...current.messages,
        ],
        messages_pagination: {
          has_more: history.has_more,
          next_cursor: history.next_cursor,
        },
      }
    })
  }, [])

  useEffect(() => {
    const pulse = () => {
      if (document.visibilityState === "visible") {
        void heartbeatPresenceAction(activeConversation?.id)
      }
    }
    pulse()
    const interval = window.setInterval(
      pulse,
      realtimeConfig.heartbeat_interval_seconds * 1000
    )
    document.addEventListener("visibilitychange", pulse)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", pulse)
    }
  }, [activeConversation?.id, realtimeConfig.heartbeat_interval_seconds])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") markAsRead(false, socketId)
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [markAsRead, socketId])

  useEffect(() => {
    if (status === "connected" || status === "connecting") return

    const fallbackRefresh = window.setInterval(() => router.refresh(), 15000)
    return () => window.clearInterval(fallbackRefresh)
  }, [router, status])

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const rootWasLocked = root.classList.contains("overflow-hidden")
    const bodyWasLocked = body.classList.contains("overflow-hidden")

    root.classList.add("overflow-hidden")
    body.classList.add("overflow-hidden")

    return () => {
      if (!rootWasLocked) root.classList.remove("overflow-hidden")
      if (!bodyWasLocked) body.classList.remove("overflow-hidden")
    }
  }, [])

  return (
    <div className="fixed inset-x-0 top-16 bottom-0 z-30 overflow-hidden bg-background lg:top-24">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:gap-6 lg:px-8 lg:py-6">
        <PageHeader
          title="Tin nhắn"
          description="Trao đổi trực tiếp với cửa hàng và nhận phản hồi ngay khi có tin nhắn mới."
        />

        <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
          <div className="grid h-full min-h-0 overflow-hidden lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside
              className={`${activeConversation ? "hidden lg:flex" : "flex"} min-h-0 flex-col overflow-hidden border-r`}
            >
              <ChatConversationList
                conversations={conversationItems}
                selectedConversationId={activeConversation?.id}
              />
            </aside>

            <section
              className={`${activeConversation ? "flex" : "hidden lg:flex"} min-h-0 flex-col overflow-hidden`}
            >
              {activeConversation ? (
                <>
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-3 sm:px-4">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <Button
                        className="lg:hidden"
                        nativeButton={false}
                        render={<Link href="/chats" />}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <ArrowLeftIcon />
                        <span className="sr-only">Quay lại danh sách</span>
                      </Button>
                      <UserAvatar
                        name={activeConversation.counterpart.name}
                        size="lg"
                        src={activeConversation.counterpart.avatar_url}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {activeConversation.counterpart.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeConversation.counterpart.is_online
                            ? "Đang hoạt động"
                            : "Không trực tuyến"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RealtimeStatusBadge status={status} />
                      <Button
                        aria-label="Đánh dấu đã đọc"
                        disabled={readPending}
                        size="icon-sm"
                        variant="outline"
                        onClick={() => markAsRead(true, socketId)}
                      >
                        {readPending ? (
                          <LoaderCircleIcon className="animate-spin" />
                        ) : (
                          <CheckCheckIcon />
                        )}
                      </Button>
                    </div>
                  </div>

                  <ChatMessageList
                    conversationSlug={activeConversation.slug}
                    currentUserId={currentUserId}
                    messages={activeConversation.messages}
                    pagination={activeConversation.messages_pagination}
                    onOlderMessages={handleOlderMessages}
                  />
                  <ChatComposer
                    conversationSlug={activeConversation.slug}
                    socketId={socketId}
                    onSent={handleSent}
                  />
                </>
              ) : (
                <CardContent className="flex h-full items-center justify-center p-6">
                  <EmptyState
                    title="Chọn một cuộc trò chuyện"
                    description="Nội dung trao đổi với người bán hoặc khách hàng sẽ hiển thị tại đây."
                  />
                </CardContent>
              )}
            </section>
          </div>
        </Card>
      </div>
    </div>
  )
}
