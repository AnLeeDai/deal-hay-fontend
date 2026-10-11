"use client"

import { useEffect, useRef, useState } from "react"
import type Echo from "laravel-echo"
import type { ConnectionStatus } from "laravel-echo"

import type { ChatMessagesReadEvent, RealtimeConfig } from "@/api/chats/types"
import type { ChatMessage } from "@/types/chat"

type ReverbEcho = Echo<"reverb">
type PresenceMember = { id: string; name: string }

type ChatRealtimeCallbacks = {
  onMessage: (message: ChatMessage) => void
  onMessagesRead: (event: ChatMessagesReadEvent) => void
  onPresenceChange: (isOnline: boolean) => void
  onReconnect: () => void
}

export function useChatRealtime({
  config,
  currentUserId,
  selectedConversationId,
  counterpartId,
  onMessage,
  onMessagesRead,
  onPresenceChange,
  onReconnect,
}: {
  config: RealtimeConfig
  currentUserId: string
  selectedConversationId?: string
  counterpartId?: string
} & ChatRealtimeCallbacks) {
  const [echo, setEcho] = useState<ReverbEcho | null>(null)
  const [socketId, setSocketId] = useState<string>()
  const [status, setStatus] = useState<ConnectionStatus>("connecting")
  const callbacks = useRef<ChatRealtimeCallbacks>({
    onMessage,
    onMessagesRead,
    onPresenceChange,
    onReconnect,
  })
  const hasConnected = useRef(false)

  useEffect(() => {
    callbacks.current = {
      onMessage,
      onMessagesRead,
      onPresenceChange,
      onReconnect,
    }
  }, [onMessage, onMessagesRead, onPresenceChange, onReconnect])

  useEffect(() => {
    let disposed = false
    let instance: ReverbEcho | undefined
    let unsubscribeConnection: (() => void) | undefined

    void Promise.all([import("laravel-echo"), import("pusher-js")])
      .then(([{ default: EchoClient }, { default: Pusher }]) => {
        if (disposed) return

        instance = new EchoClient<"reverb">({
          broadcaster: "reverb",
          key: config.key,
          wsHost: config.host,
          wsPort: config.port,
          wssPort: config.port,
          forceTLS: config.scheme === "https",
          enabledTransports: ["ws", "wss"],
          authEndpoint: "/api/broadcasting/auth",
          auth: { headers: { Accept: "application/json" } },
          Pusher,
          withoutInterceptors: true,
        })

        setEcho(instance)
        setStatus(instance.connectionStatus())
        instance
          .private(`user-chat.${currentUserId}`)
          .listen(".message.sent", (payload: unknown) => {
            if (
              payload &&
              typeof payload === "object" &&
              "id" in payload &&
              "conversation_id" in payload
            ) {
              callbacks.current.onMessage(payload as ChatMessage)
            }
          })
          .error(() => setStatus("failed"))

        unsubscribeConnection = instance.connector.onConnectionChange(
          (nextStatus) => {
            setStatus(nextStatus)
            setSocketId(instance?.socketId())

            if (nextStatus !== "connected") return
            if (hasConnected.current) callbacks.current.onReconnect()
            hasConnected.current = true
          }
        )
      })
      .catch(() => {
        if (!disposed) setStatus("failed")
      })

    return () => {
      disposed = true
      unsubscribeConnection?.()
      instance?.disconnect()
      hasConnected.current = false
      setEcho(null)
      setSocketId(undefined)
    }
  }, [config.host, config.key, config.port, config.scheme, currentUserId])

  useEffect(() => {
    if (!echo || !selectedConversationId || !counterpartId) return

    const onlineMemberIds = new Set<string>()
    const updatePresence = () =>
      callbacks.current.onPresenceChange(onlineMemberIds.has(counterpartId))

    echo
      .private(`chat.${selectedConversationId}`)
      .listen(".messages.read", (payload: unknown) => {
        if (payload && typeof payload === "object") {
          callbacks.current.onMessagesRead(payload as ChatMessagesReadEvent)
        }
      })
      .error(() => setStatus("failed"))

    echo
      .join(`chat-presence.${selectedConversationId}`)
      .here((members: PresenceMember[]) => {
        onlineMemberIds.clear()
        members.forEach((member) => onlineMemberIds.add(String(member.id)))
        updatePresence()
      })
      .joining((member: PresenceMember) => {
        onlineMemberIds.add(String(member.id))
        updatePresence()
      })
      .leaving((member: PresenceMember) => {
        onlineMemberIds.delete(String(member.id))
        updatePresence()
      })
      .error(() => setStatus("failed"))

    return () => {
      echo.leave(`chat.${selectedConversationId}`)
      echo.leave(`chat-presence.${selectedConversationId}`)
    }
  }, [counterpartId, echo, selectedConversationId])

  return { socketId, status }
}
