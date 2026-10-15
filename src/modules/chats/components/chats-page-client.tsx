"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
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
} from "@/api/chats/types"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { useRealtime } from "@/components/realtime-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import {
  heartbeatPresenceAction,
  markConversationReadAction,
  synchronizeChatsAction,
} from "@/modules/chats/actions"
import { ChatComposer } from "@/modules/chats/components/chat-composer"
import { ChatConversationList } from "@/modules/chats/components/chat-conversation-list"
import { ChatMessageList } from "@/modules/chats/components/chat-message-list"
import { useChatRealtime } from "@/modules/chats/hooks/use-chat-realtime"
import {
  createChatState,
  mergeMessages,
  receiveChatMessage,
  receiveReadReceipt,
  reconcileChatState,
} from "@/modules/chats/lib/chat-state"
import type {
  ChatMessage,
  ChatReply,
  ConversationSummary,
  SelectedConversation,
} from "@/types/chat"

function RealtimeStatusBadge({
  status,
  latencyMs,
  pingTimedOut,
}: {
  status: ConnectionStatus
  latencyMs: number | null
  pingTimedOut: boolean
}) {
  if (status === "connected") {
    return (
      <Badge
        title="Độ trễ khứ hồi tới máy chủ tin nhắn"
        variant={pingTimedOut ? "outline" : "secondary"}
      >
        <WifiIcon /> Trực tiếp ·{" "}
        {latencyMs !== null
          ? `Ping ${latencyMs} ms`
          : pingTimedOut
            ? "Ping quá hạn"
            : "Đang đo ping…"}
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
}: {
  conversations: ConversationSummary[]
  selectedConversation: SelectedConversation | null
  currentUserId: string
}) {
  const [state, setState] = useState(() =>
    createChatState({ conversations, selectedConversation })
  )
  const conversationItems = state.conversations
  const activeConversation = state.selectedConversation
  const [readPending, startReadTransition] = useTransition()
  const [synchronizationFailed, setSynchronizationFailed] = useState(false)
  const [replyDraft, setReplyDraft] = useState<{
    conversationId: string
    reply: ChatReply
  } | null>(null)
  const { synchronizeUnreadCounts, heartbeatIntervalSeconds } = useRealtime()
  const socketIdRef = useRef<string | undefined>(undefined)
  const mounted = useRef(true)
  const synchronization = useRef<Promise<void> | null>(null)
  const synchronizeAgain = useRef(false)
  const conversationRevisions = useRef(new Map<string, number>())
  const conversationId = activeConversation?.id
  const conversationSlug = activeConversation?.slug
  const replyTo =
    replyDraft && replyDraft.conversationId === conversationId
      ? replyDraft.reply
      : null
  const markAsReadRef = useRef<() => void>(() => {})

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const synchronize = useCallback(() => {
    synchronizeAgain.current = true
    if (synchronization.current) return
    synchronization.current = (async () => {
      while (synchronizeAgain.current && mounted.current) {
        synchronizeAgain.current = false
        const revisions = new Map(conversationRevisions.current)
        const snapshot = await synchronizeChatsAction(
          selectedConversation?.slug
        )
        if (!mounted.current) return
        if (!snapshot) {
          setSynchronizationFailed(true)
          return
        }
        setSynchronizationFailed(false)
        const changed = new Set(
          [...conversationRevisions.current]
            .filter(([id, revision]) => revisions.get(id) !== revision)
            .map(([id]) => id)
        )
        setState((current) => reconcileChatState(current, snapshot, changed))
        if (
          snapshot.selectedConversation?.unread_count &&
          document.visibilityState === "visible"
        ) {
          markAsReadRef.current()
        }
        await synchronizeUnreadCounts()
      }
    })().finally(() => {
      synchronization.current = null
    })
  }, [selectedConversation?.slug, synchronizeUnreadCounts])

  const markAsRead = useCallback(
    (showConfirmation = false, socketId?: string) => {
      if (!conversationId || !conversationSlug) return
      const revision = conversationRevisions.current.get(conversationId)
      startReadTransition(async () => {
        const result = await markConversationReadAction(
          conversationSlug,
          socketId
        )
        if (!mounted.current) return
        if (!result.success) {
          if (showConfirmation) toast.error(result.message)
          return
        }
        if (revision === conversationRevisions.current.get(conversationId)) {
          conversationRevisions.current.set(conversationId, (revision ?? 0) + 1)
          setState((current) => ({
            ...current,
            conversations: current.conversations.map((conversation) =>
              conversation.id === conversationId
                ? { ...conversation, unread_count: 0 }
                : conversation
            ),
            selectedConversation:
              current.selectedConversation?.id === conversationId
                ? { ...current.selectedConversation, unread_count: 0 }
                : current.selectedConversation,
          }))
        } else {
          synchronize()
        }
        await synchronizeUnreadCounts()
        if (showConfirmation) toast.success(result.message)
      })
    },
    [conversationId, conversationSlug, synchronize, synchronizeUnreadCounts]
  )

  useEffect(() => {
    markAsReadRef.current = () => markAsRead(false, socketIdRef.current)
  }, [markAsRead])

  const handleIncomingMessage = useCallback(
    (message: ChatMessage) => {
      const revisions = conversationRevisions.current
      revisions.set(
        message.conversation_id,
        (revisions.get(message.conversation_id) ?? 0) + 1
      )
      setState((current) => receiveChatMessage(current, message, currentUserId))
      if (!conversationItems.some(({ id }) => id === message.conversation_id))
        synchronize()
      if (
        activeConversation?.id === message.conversation_id &&
        document.visibilityState === "visible"
      ) {
        markAsRead(false, socketIdRef.current)
      }
    },
    [
      activeConversation?.id,
      conversationItems,
      currentUserId,
      markAsRead,
      synchronize,
    ]
  )

  const handleMessagesRead = useCallback(
    (event: ChatMessagesReadEvent) => {
      const revisions = conversationRevisions.current
      revisions.set(
        event.conversation_id,
        (revisions.get(event.conversation_id) ?? 0) + 1
      )
      setState((current) => receiveReadReceipt(current, event, currentUserId))
      if (event.reader_id === currentUserId) synchronize()
    },
    [currentUserId, synchronize]
  )

  const handlePresenceChange = useCallback((isOnline: boolean) => {
    setState((current) => {
      const selected = current.selectedConversation
      if (!selected || selected.counterpart.is_online === isOnline)
        return current
      return {
        ...current,
        selectedConversation: {
          ...selected,
          counterpart: { ...selected.counterpart, is_online: isOnline },
        },
        conversations: current.conversations.map((conversation) =>
          conversation.id === selected.id
            ? {
                ...conversation,
                counterpart: {
                  ...conversation.counterpart,
                  is_online: isOnline,
                },
              }
            : conversation
        ),
      }
    })
  }, [])

  const { socketId, status, reconnect, latencyMs, pingTimedOut } =
    useChatRealtime({
      currentUserId,
      selectedConversationId: activeConversation?.id,
      counterpartId: activeConversation?.counterpart.id,
      onMessage: handleIncomingMessage,
      onMessagesRead: handleMessagesRead,
      onPresenceChange: handlePresenceChange,
      onReconnect: synchronize,
    })

  useEffect(() => {
    socketIdRef.current = socketId
  }, [socketId])

  const handleSent = useCallback(
    (message: ChatMessage, submittedReplyId?: string | null) => {
      const revisions = conversationRevisions.current
      revisions.set(
        message.conversation_id,
        (revisions.get(message.conversation_id) ?? 0) + 1
      )
      setState((current) => receiveChatMessage(current, message, currentUserId))
      setReplyDraft((current) =>
        current?.conversationId === message.conversation_id &&
        current.reply.id === submittedReplyId
          ? null
          : current
      )
    },
    [currentUserId]
  )

  const handleReply = useCallback(
    (message: ChatMessage) => {
      if (message.conversation_id !== conversationId) return
      setReplyDraft({
        conversationId: message.conversation_id,
        reply: {
          id: message.id,
          body: message.body,
          sender: message.sender,
          attachment: message.attachment
            ? {
                type: message.attachment.type,
                name: message.attachment.name,
              }
            : null,
          product: message.product ? { name: message.product.name } : null,
        },
      })
    },
    [conversationId]
  )

  const handleOlderMessages = useCallback((history: ChatHistoryResponse) => {
    setState((current) => {
      const selected = current.selectedConversation
      if (!selected) return current
      return {
        ...current,
        selectedConversation: {
          ...selected,
          messages: mergeMessages(selected.messages, history.messages),
          messages_pagination: {
            has_more: history.has_more,
            next_cursor: history.next_cursor,
          },
        },
        messageIds: new Set([
          ...current.messageIds,
          ...history.messages.map(({ id }) => id),
        ]),
        knownMessages: new Map([
          ...current.knownMessages,
          ...history.messages.map((message) => [message.id, message] as const),
        ]),
      }
    })
  }, [])

  useEffect(() => {
    const pulse = () => {
      if (document.visibilityState === "visible")
        void heartbeatPresenceAction(activeConversation?.id)
    }
    pulse()
    const interval = window.setInterval(pulse, heartbeatIntervalSeconds * 1000)
    document.addEventListener("visibilitychange", pulse)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", pulse)
    }
  }, [activeConversation?.id, heartbeatIntervalSeconds])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") markAsRead(false, socketId)
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [markAsRead, socketId])

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
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <RealtimeStatusBadge
                latencyMs={latencyMs}
                pingTimedOut={pingTimedOut}
                status={status}
              />
              {(status === "failed" || status === "disconnected") && (
                <Button variant="outline" size="sm" onClick={reconnect}>
                  Kết nối lại
                </Button>
              )}
              {status === "connected" && synchronizationFailed && (
                <Button variant="outline" size="sm" onClick={synchronize}>
                  Đồng bộ lại
                </Button>
              )}
            </div>
          }
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
                    key={`messages-${activeConversation.id}`}
                    conversationSlug={activeConversation.slug}
                    currentUserId={currentUserId}
                    messages={activeConversation.messages}
                    pagination={activeConversation.messages_pagination}
                    onOlderMessages={handleOlderMessages}
                    onReply={handleReply}
                  />
                  <ChatComposer
                    key={activeConversation.id}
                    conversationSlug={activeConversation.slug}
                    replyTo={replyTo}
                    socketId={socketId}
                    onCancelReply={() => setReplyDraft(null)}
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
