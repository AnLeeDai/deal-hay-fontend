import type { ChatsResponse, ChatMessagesReadEvent } from "@/api/chats/types"
import type { ChatMessage, ConversationSummary } from "@/types/chat"

export type ChatState = ChatsResponse & {
  messageIds: ReadonlySet<string>
  knownMessages: ReadonlyMap<string, ChatMessage>
  readReceipts: ReadonlyMap<string, ChatMessagesReadEvent>
}

export function createChatState(data: ChatsResponse): ChatState {
  return {
    ...data,
    messageIds: new Set(
      data.selectedConversation?.messages.map(({ id }) => id)
    ),
    knownMessages: new Map(
      data.selectedConversation?.messages.map((message) => [
        message.id,
        message,
      ])
    ),
    readReceipts: new Map(),
  }
}

export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const messages = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) {
    const previous = messages.get(message.id)
    messages.set(message.id, {
      ...previous,
      ...message,
      read_at: message.read_at ?? previous?.read_at ?? null,
    })
  }
  return [...messages.values()].sort(
    (a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      a.id.localeCompare(b.id)
  )
}

export function receiveChatMessage(
  state: ChatState,
  message: ChatMessage,
  currentUserId: string
): ChatState {
  if (state.messageIds.has(message.id)) return state

  for (const receipt of state.readReceipts.values()) {
    if (
      receipt.conversation_id === message.conversation_id &&
      receipt.reader_id !== message.sender.id &&
      message.created_at &&
      message.created_at <= receipt.read_through_at
    ) {
      message = { ...message, read_at: message.read_at ?? receipt.read_at }
    }
  }

  const update = <T extends ConversationSummary>(conversation: T): T => {
    if (conversation.id !== message.conversation_id) return conversation
    const isLatest =
      (message.created_at ?? "") >= (conversation.updated_at ?? "")
    return {
      ...conversation,
      ...(isLatest
        ? { last_message: message.body, updated_at: message.created_at }
        : {}),
      unread_count:
        conversation.unread_count +
        (message.sender.id !== currentUserId && !message.read_at ? 1 : 0),
    }
  }
  const conversations = state.conversations
    .map(update)
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
  const selected = state.selectedConversation

  return {
    ...state,
    conversations,
    selectedConversation:
      selected?.id === message.conversation_id
        ? {
            ...update(selected),
            messages: mergeMessages(selected.messages, [message]),
          }
        : selected,
    messageIds: new Set([...state.messageIds, message.id]),
    knownMessages: new Map([...state.knownMessages, [message.id, message]]),
  }
}

export function receiveReadReceipt(
  state: ChatState,
  event: ChatMessagesReadEvent,
  currentUserId: string
): ChatState {
  const cleared = event.reader_id === currentUserId
  const receiptKey = `${event.conversation_id}:${event.reader_id}`
  const previous = state.readReceipts.get(receiptKey)
  if (previous && previous.read_through_at > event.read_through_at) return state
  const ids = new Set(event.message_ids)
  const knownMessages = new Map(state.knownMessages)
  let newlyRead = 0
  for (const [id, message] of knownMessages) {
    if (
      message.conversation_id === event.conversation_id &&
      message.sender.id !== event.reader_id &&
      (ids.has(id) ||
        (message.created_at && message.created_at <= event.read_through_at))
    ) {
      if (!message.read_at && message.sender.id !== currentUserId)
        newlyRead += 1
      knownMessages.set(id, { ...message, read_at: event.read_at })
    }
  }
  const update = <T extends ConversationSummary>(conversation: T): T => {
    if (!cleared || conversation.id !== event.conversation_id)
      return conversation
    return {
      ...conversation,
      unread_count:
        (conversation.updated_at ?? "") <= event.read_through_at
          ? 0
          : Math.max(0, conversation.unread_count - newlyRead),
    }
  }
  const conversations = state.conversations.map(update)
  const selected = state.selectedConversation
  return {
    ...state,
    conversations,
    knownMessages,
    readReceipts: new Map([...state.readReceipts, [receiptKey, event]]),
    selectedConversation:
      selected?.id === event.conversation_id
        ? {
            ...update(selected),
            messages: selected.messages.map(
              (message) => knownMessages.get(message.id) ?? message
            ),
          }
        : selected,
  }
}

export function reconcileChatState(
  state: ChatState,
  snapshot: ChatsResponse,
  changedSinceSnapshot: ReadonlySet<string> = new Set()
): ChatState {
  const current = new Map(
    state.conversations.map((conversation) => [conversation.id, conversation])
  )
  const conversations = snapshot.conversations.map((conversation) => {
    const previous = current.get(conversation.id)
    current.delete(conversation.id)
    return previous &&
      (changedSinceSnapshot.has(conversation.id) ||
        (previous.updated_at ?? "") > (conversation.updated_at ?? ""))
      ? previous
      : conversation
  })
  conversations.push(...current.values())
  conversations.sort((a, b) =>
    (b.updated_at ?? "").localeCompare(a.updated_at ?? "")
  )
  const selected = snapshot.selectedConversation
  const previous = state.selectedConversation
  const hasOverlap = selected?.messages.some(({ id }) =>
    state.messageIds.has(id)
  )
  let messages = selected
    ? mergeMessages(
        previous?.id === selected.id ? previous.messages : [],
        selected.messages
      )
    : []
  for (const receipt of state.readReceipts.values()) {
    const ids = new Set(receipt.message_ids)
    messages = messages.map((message) =>
      ids.has(message.id)
        ? { ...message, read_at: message.read_at ?? receipt.read_at }
        : message
    )
  }

  return {
    ...state,
    conversations,
    selectedConversation:
      selected && previous?.id === selected.id
        ? {
            ...selected,
            ...conversations.find(({ id }) => id === selected.id),
            counterpart: {
              ...selected.counterpart,
              is_online: previous.counterpart.is_online,
            },
            messages,
            messages_pagination:
              hasOverlap && previous.messages.length > selected.messages.length
                ? previous.messages_pagination
                : selected.messages_pagination,
          }
        : selected,
    messageIds: new Set([
      ...state.messageIds,
      ...(selected?.messages.map(({ id }) => id) ?? []),
    ]),
    knownMessages: new Map([
      ...state.knownMessages,
      ...messages.map((message) => [message.id, message] as const),
    ]),
  }
}
