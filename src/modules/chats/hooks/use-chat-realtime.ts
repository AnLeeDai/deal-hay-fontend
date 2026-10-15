"use client"

import { useEffect, useRef } from "react"

import type { ChatMessagesReadEvent } from "@/api/chats/types"
import { useRealtime } from "@/components/realtime-provider"
import type { ChatMessage } from "@/types/chat"

type PresenceMember = { id: string; name: string }
type ChatRealtimeCallbacks = {
  onMessage: (message: ChatMessage) => void
  onMessagesRead: (event: ChatMessagesReadEvent) => void
  onPresenceChange: (isOnline: boolean) => void
  onReconnect: () => void
}

export function useChatRealtime({
  currentUserId,
  selectedConversationId,
  counterpartId,
  onMessage,
  onMessagesRead,
  onPresenceChange,
  onReconnect,
}: {
  currentUserId: string
  selectedConversationId?: string
  counterpartId?: string
} & ChatRealtimeCallbacks) {
  const { echo, socketId, status, subscriptionVersion, reconnect } =
    useRealtime()
  const callbacks = useRef({
    onMessage,
    onMessagesRead,
    onPresenceChange,
    onReconnect,
  })

  useEffect(() => {
    callbacks.current = {
      onMessage,
      onMessagesRead,
      onPresenceChange,
      onReconnect,
    }
  }, [onMessage, onMessagesRead, onPresenceChange, onReconnect])

  useEffect(() => {
    if (!echo) return

    const channel = echo.private(`user-chat.${currentUserId}`)
    const messageListener = (payload: ChatMessage) => {
      if (payload?.id && payload.conversation_id && payload.sender?.id) {
        callbacks.current.onMessage(payload)
      }
    }
    const readListener = (payload: ChatMessagesReadEvent) => {
      if (payload?.conversation_id && Array.isArray(payload.message_ids)) {
        callbacks.current.onMessagesRead(payload)
      }
    }
    channel
      .listen(".message.sent", messageListener)
      .listen(".messages.read", readListener)

    return () => {
      channel.stopListening(".message.sent", messageListener)
      channel.stopListening(".messages.read", readListener)
    }
  }, [currentUserId, echo])

  useEffect(() => {
    if (subscriptionVersion > 0) callbacks.current.onReconnect()
  }, [subscriptionVersion])

  useEffect(() => {
    if (!echo || !selectedConversationId || !counterpartId) return

    const onlineMemberIds = new Set<string>()
    const updatePresence = () =>
      callbacks.current.onPresenceChange(onlineMemberIds.has(counterpartId))

    echo
      .join(`chat-presence.${selectedConversationId}`)
      .here((members: PresenceMember[]) => {
        onlineMemberIds.clear()
        members.forEach(({ id }) => onlineMemberIds.add(String(id)))
        updatePresence()
      })
      .joining(({ id }: PresenceMember) => {
        onlineMemberIds.add(String(id))
        updatePresence()
      })
      .leaving(({ id }: PresenceMember) => {
        onlineMemberIds.delete(String(id))
        updatePresence()
      })
      .error(() => callbacks.current.onPresenceChange(false))

    return () => echo.leave(`chat-presence.${selectedConversationId}`)
  }, [counterpartId, echo, selectedConversationId])

  useEffect(() => {
    if (status !== "connected") callbacks.current.onPresenceChange(false)
  }, [status])

  return { socketId, status, reconnect }
}
