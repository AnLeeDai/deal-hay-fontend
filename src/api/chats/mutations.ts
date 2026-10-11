import { apiFetch } from "@/api/client"
import { chatRoutes } from "@/api/chats/routes"
import type { PresenceHeartbeatResponse } from "@/api/chats/types"
import type { ChatMessage } from "@/types/chat"

export function sendChatMessage(
  conversationSlug: string,
  formData: FormData,
  idempotencyKey: string,
  socketId?: string
): Promise<ChatMessage> {
  return apiFetch({
    method: "POST",
    path: chatRoutes.send(conversationSlug),
    body: formData,
    headers: {
      "Idempotency-Key": idempotencyKey,
      ...(socketId ? { "X-Socket-ID": socketId } : {}),
    },
  })
}

export function markConversationRead(
  conversationSlug: string,
  socketId?: string
): Promise<{ ok: boolean }> {
  return apiFetch({
    method: "PATCH",
    path: chatRoutes.read(conversationSlug),
    headers: socketId ? { "X-Socket-ID": socketId } : undefined,
  })
}

export function recordPresenceHeartbeat(
  conversationId?: string
): Promise<PresenceHeartbeatResponse> {
  return apiFetch({
    method: "POST",
    path: chatRoutes.presence,
    body: { conversation_id: conversationId ?? null },
  })
}
