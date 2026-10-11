"use server"

import { revalidatePath } from "next/cache"

import { ApiError } from "@/api/client"
import {
  markConversationRead,
  recordPresenceHeartbeat,
  sendChatMessage,
} from "@/api/chats/mutations"
import { getChatHistory } from "@/api/chats/queries"
import type { ChatHistoryResponse } from "@/api/chats/types"
import type { ActionState } from "@/types/forms"
import { sendMessageSchema } from "@/modules/chats/schemas/chats"
import type { ChatMessage } from "@/types/chat"

export type SendMessageActionState = ActionState & { data?: ChatMessage }
export type ChatHistoryActionState = ActionState & {
  data?: ChatHistoryResponse
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
    revalidatePath("/", "layout")
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
    body: formData.get("body"),
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

  try {
    const message = await sendChatMessage(
      conversationSlug,
      payload,
      String(payload.get("client_message_id")),
      validSocketId(formData.get("socket_id"))
    )
    revalidatePath(`/chats/${conversationSlug}`)
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
