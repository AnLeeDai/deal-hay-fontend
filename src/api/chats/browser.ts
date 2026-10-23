import { liveApiFetch } from "@/api/live-client"
import { chatRoutes } from "@/api/chats/routes"
import type {
  ChatHistoryResponse,
  ChatsResponse,
  PresenceHeartbeatResponse,
} from "@/api/chats/types"
import type { MeResponse } from "@/api/auth/types"
import type { ChatMessage } from "@/types/chat"
import type { SessionUser } from "@/types/auth"

export async function getCurrentSession(): Promise<SessionUser> {
  const response = await liveApiFetch<MeResponse>("/auth/me")
  return {
    user: response.data,
    unreadCounts: {
      messages: response.meta.unread_messages_count,
      notifications: response.meta.unread_notifications_count,
    },
  }
}

export function getChats(): Promise<ChatsResponse> {
  return liveApiFetch(chatRoutes.list)
}

export function getChatHistory(
  slug: string,
  cursor?: string,
  limit?: number
): Promise<ChatHistoryResponse> {
  return liveApiFetch(chatRoutes.history(encodeURIComponent(slug)), {
    searchParams: { cursor, limit },
  })
}

export function sendChatMessage(
  slug: string,
  body: FormData,
  idempotencyKey: string,
  socketId?: string
): Promise<ChatMessage> {
  return liveApiFetch(chatRoutes.send(encodeURIComponent(slug)), {
    method: "POST",
    body,
    headers: {
      "Idempotency-Key": idempotencyKey,
      ...(socketId ? { "X-Socket-ID": socketId } : {}),
    },
  })
}

export function markConversationRead(
  slug: string,
  socketId?: string
): Promise<{ ok: boolean }> {
  return liveApiFetch(chatRoutes.read(encodeURIComponent(slug)), {
    method: "PATCH",
    headers: socketId ? { "X-Socket-ID": socketId } : undefined,
  })
}

export function recordPresenceHeartbeat(
  conversationId?: string
): Promise<PresenceHeartbeatResponse> {
  return liveApiFetch(chatRoutes.presence, {
    method: "POST",
    body: { conversation_id: conversationId ?? null },
  })
}
