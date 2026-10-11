import { apiFetch } from "@/api/client"
import { chatRoutes } from "@/api/chats/routes"
import type {
  ChatHistoryResponse,
  ChatsResponse,
  RealtimeConfig,
} from "@/api/chats/types"

export function getChats(
  conversationSlug?: string,
  limit?: number
): Promise<ChatsResponse> {
  if (!conversationSlug) {
    return apiFetch({ path: chatRoutes.list })
  }
  return apiFetch({
    path: chatRoutes.detail(conversationSlug),
    searchParams: { limit },
  })
}

export function getChatHistory(
  conversationSlug: string,
  cursor?: string,
  limit?: number
): Promise<ChatHistoryResponse> {
  return apiFetch({
    path: chatRoutes.history(conversationSlug),
    searchParams: { cursor, limit },
  })
}

export function getRealtimeConfig(): Promise<RealtimeConfig> {
  return apiFetch({ path: chatRoutes.realtimeConfig })
}
