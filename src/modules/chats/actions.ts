"use server"

import { ApiError } from "@/api/client"
import { getCurrentSession } from "@/api/auth/queries"
import {
  markConversationRead,
  recordPresenceHeartbeat,
  sendChatMessage,
} from "@/api/chats/mutations"
import { getChatHistory, getChats } from "@/api/chats/queries"
import type { ChatHistoryResponse, ChatsResponse } from "@/api/chats/types"
import type { UnreadCounts } from "@/types/auth"
import type { ActionState } from "@/types/forms"
import { sendMessageSchema } from "@/modules/chats/schemas/chats"
import type { ChatMessage } from "@/types/chat"

export type SendMessageActionState = ActionState & { data?: ChatMessage }
export type ChatHistoryActionState = ActionState & {
  data?: ChatHistoryResponse
}

export async function refreshUnreadCountsAction(): Promise<UnreadCounts | null> {
  try {
    const session = await getCurrentSession()
    return session.user ? session.unreadCounts : null
  } catch {
    return null
  }
}

export async function synchronizeChatsAction(
  conversationSlug?: string
): Promise<ChatsResponse | null> {
  try {
    const [data, history] = await Promise.all([
      getChats(),
      conversationSlug ? getChatHistory(conversationSlug, undefined, 50) : null,
    ])
    const conversation = data.conversations.find(
      ({ slug }) => slug === conversationSlug
    )
    return {
      conversations: data.conversations,
      selectedConversation:
        conversation && history
          ? {
              ...conversation,
              messages: history.messages,
              messages_pagination: {
                has_more: history.has_more,
                next_cursor: history.next_cursor,
              },
            }
          : null,
    }
  } catch {
    return null
  }
}

function validSocketId(
  value: FormDataEntryValue | string | null | undefined
): string | undefined {
  return typeof value === "string" && /^\d+\.\d+$/.test(value)
    ? value
    : undefined
}

export async function markConversationReadAction(
  conversationSlug: string,
  socketId?: string
): Promise<ActionState> {
  try {
    await markConversationRead(conversationSlug, validSocketId(socketId))
    return { success: true, message: "Đã cập nhật trạng thái đã đọc." }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.message
          : "Không thể cập nhật trạng thái đã đọc.",
    }
  }
}

export async function sendMessageAction(
  conversationSlug: string,
  formData: FormData
): Promise<SendMessageActionState> {
  const parsed = sendMessageSchema.safeParse({
    body: formData.get("body") ?? "",
    reply_to_id: formData.get("reply_to_id") || undefined,
    attachment:
      formData.get("attachment") instanceof File &&
      (formData.get("attachment") as File).size > 0
        ? formData.get("attachment")
        : undefined,
  })

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại tin nhắn.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const payload = new FormData()
  payload.set("client_message_id", crypto.randomUUID())
  if (parsed.data.body && parsed.data.body !== "") {
    payload.set("body", parsed.data.body)
  }
  if (parsed.data.attachment instanceof File) {
    payload.set("attachment", parsed.data.attachment)
  }
  if (parsed.data.reply_to_id) {
    payload.set("reply_to_id", parsed.data.reply_to_id)
  }

  try {
    const message = await sendChatMessage(
      conversationSlug,
      payload,
      String(payload.get("client_message_id")),
      validSocketId(formData.get("socket_id"))
    )
    return { success: true, message: "Đã gửi tin nhắn.", data: message }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message, errors: error.errors }
    }
    return { success: false, message: "Không thể gửi tin nhắn." }
  }
}

export async function loadChatHistoryAction(
  conversationSlug: string,
  cursor: string
): Promise<ChatHistoryActionState> {
  try {
    const data = await getChatHistory(conversationSlug, cursor, 20)
    return { success: true, message: "", data }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.message
          : "Không thể tải thêm tin nhắn.",
    }
  }
}

export async function heartbeatPresenceAction(
  conversationId?: string
): Promise<ActionState> {
  try {
    await recordPresenceHeartbeat(conversationId)
    return { success: true, message: "" }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.message
          : "Không thể cập nhật trạng thái trực tuyến.",
    }
  }
}
