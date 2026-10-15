import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import ts from "typescript"

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL("../src/modules/chats/lib/chat-state.ts", import.meta.url),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
)
const {
  createChatState,
  mergeMessages,
  receiveChatMessage,
  receiveReadReceipt,
  reconcileChatState,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
)

const currentUserId = "buyer-1"
const conversationId = "conversation-1"
const counterpartId = "shop-owner-1"
const timestamp = (minute) =>
  new Date(Date.UTC(2026, 9, 15, 3, minute)).toISOString()

function message(id, minute, overrides = {}) {
  return {
    id,
    conversation_id: conversationId,
    client_message_id: `client-${id}`,
    body: `Message ${id}`,
    read_at: null,
    attachment: null,
    product: null,
    sender: { id: counterpartId, name: "Test Shop", avatar_url: null },
    created_at: timestamp(minute),
    ...overrides,
  }
}

function summary(overrides = {}) {
  return {
    id: conversationId,
    slug: "test-shop-va-test-buyer",
    counterpart: {
      id: counterpartId,
      name: "Test Shop",
      avatar_url: null,
      is_online: true,
      is_shop: true,
    },
    last_message: "Earlier message",
    unread_count: 0,
    updated_at: timestamp(0),
    ...overrides,
  }
}

function snapshot({
  messages = [],
  conversation = summary(),
  otherConversations = [],
  pagination,
} = {}) {
  return {
    conversations: [conversation, ...otherConversations],
    selectedConversation: {
      ...conversation,
      messages,
      messages_pagination: pagination ?? { has_more: false, next_cursor: null },
    },
  }
}

function receipt(
  messages,
  { readerId = currentUserId, throughMinute = 1, readMinute = 5 } = {}
) {
  return {
    conversation_id: conversationId,
    reader_id: readerId,
    message_ids: messages.map(({ id }) => id),
    read_at: timestamp(readMinute),
    read_through_at: timestamp(throughMinute),
  }
}

test("a socket message appears immediately and moves its conversation to the top", () => {
  const olderState = createChatState(
    snapshot({
      otherConversations: [
        summary({ id: "conversation-2", updated_at: timestamp(1) }),
      ],
    })
  )
  const incoming = message("m1", 2)

  const state = receiveChatMessage(olderState, incoming, currentUserId)

  assert.deepEqual(state.selectedConversation.messages, [incoming])
  assert.equal(state.selectedConversation.unread_count, 1)
  assert.equal(state.conversations[0].id, conversationId)
  assert.equal(state.conversations[0].last_message, incoming.body)
  assert.equal(state.conversations[0].updated_at, incoming.created_at)
  assert.equal(state.conversations[0].unread_count, 1)
  assert.deepEqual(olderState.selectedConversation.messages, [])
})

test("duplicate socket events and an HTTP response do not duplicate a message or its unread count", () => {
  const incoming = message("m1", 1)
  const state = receiveChatMessage(
    createChatState(snapshot()),
    incoming,
    currentUserId
  )
  const duplicate = receiveChatMessage(
    state,
    { ...incoming, replayed: true },
    currentUserId
  )
  const readAt = timestamp(3)
  const merged = mergeMessages(
    [{ ...incoming, read_at: readAt }],
    [{ ...incoming, read_at: null, replayed: true }]
  )

  assert.equal(duplicate.conversations[0].unread_count, 1)
  assert.deepEqual(
    duplicate.selectedConversation.messages.map(({ id }) => id),
    [incoming.id]
  )
  assert.equal(merged.length, 1)
  assert.equal(merged[0].read_at, readAt)
})

test("a message from another tab of the current user preserves the unread count", () => {
  const initial = createChatState(
    snapshot({ conversation: summary({ unread_count: 2 }) })
  )
  const outgoing = message("own-message", 1, {
    sender: { id: currentUserId, name: "Test Buyer", avatar_url: null },
  })

  const state = receiveChatMessage(initial, outgoing, currentUserId)

  assert.equal(state.conversations[0].unread_count, 2)
  assert.equal(state.selectedConversation.unread_count, 2)
  assert.equal(state.selectedConversation.messages[0].id, outgoing.id)
  assert.equal(state.conversations[0].last_message, outgoing.body)
})

test("an out-of-order socket message keeps the newest conversation preview", () => {
  const newest = message("m3", 3)
  const initial = createChatState(
    snapshot({
      conversation: summary({
        last_message: newest.body,
        updated_at: newest.created_at,
        unread_count: 1,
      }),
      messages: [newest],
    })
  )
  const delayed = message("m2", 2)

  const state = receiveChatMessage(initial, delayed, currentUserId)

  assert.equal(state.conversations[0].last_message, newest.body)
  assert.equal(state.conversations[0].updated_at, newest.created_at)
  assert.equal(state.conversations[0].unread_count, 2)
  assert.deepEqual(
    state.selectedConversation.messages.map(({ id }) => id),
    ["m2", "m3"]
  )
})

test("a delayed receipt for m1 leaves the newer m2 unread", () => {
  const first = message("m1", 1)
  const second = message("m2", 2)
  let state = createChatState(snapshot())
  state = receiveChatMessage(state, first, currentUserId)
  state = receiveChatMessage(state, second, currentUserId)

  const event = receipt([first])
  state = receiveReadReceipt(state, event, currentUserId)

  assert.equal(state.conversations[0].unread_count, 1)
  assert.equal(state.selectedConversation.unread_count, 1)
  assert.equal(state.selectedConversation.messages[0].read_at, event.read_at)
  assert.equal(state.selectedConversation.messages[1].read_at, null)
  assert.equal(state.conversations[0].last_message, second.body)
  assert.equal(
    receiveReadReceipt(state, event, currentUserId).conversations[0]
      .unread_count,
    1
  )
})

test("a receipt arriving before its message prevents that message becoming unread", () => {
  const incoming = message("m1", 1)
  const event = receipt([incoming])
  const withReceipt = receiveReadReceipt(
    createChatState(snapshot()),
    event,
    currentUserId
  )

  const state = receiveChatMessage(withReceipt, incoming, currentUserId)

  assert.equal(state.conversations[0].unread_count, 0)
  assert.equal(state.selectedConversation.unread_count, 0)
  assert.equal(state.selectedConversation.messages[0].read_at, event.read_at)
  assert.equal(state.knownMessages.get(incoming.id).read_at, event.read_at)
})

test("a snapshot captured before a socket update preserves live unread, preview and messages", () => {
  const incoming = message("m1", 2)
  const live = receiveChatMessage(
    createChatState(snapshot()),
    incoming,
    currentUserId
  )
  const stale = snapshot({
    conversation: summary({ updated_at: incoming.created_at, unread_count: 0 }),
  })

  const state = reconcileChatState(live, stale, new Set([conversationId]))

  assert.equal(state.conversations[0].unread_count, 1)
  assert.equal(state.conversations[0].last_message, incoming.body)
  assert.equal(state.selectedConversation.unread_count, 1)
  assert.equal(state.selectedConversation.last_message, incoming.body)
  assert.deepEqual(
    state.selectedConversation.messages.map(({ id }) => id),
    [incoming.id]
  )
})

test("a reconnect snapshot retains loaded history, read receipts and its older pagination cursor", () => {
  const messages = [
    message("m1", 1),
    message("m2", 2),
    message("m3", 3),
    message("m4", 4, {
      sender: { id: currentUserId, name: "Test Buyer", avatar_url: null },
    }),
  ]
  const conversation = summary({
    last_message: messages[3].body,
    updated_at: timestamp(4),
  })
  const pagination = { has_more: true, next_cursor: "before-m1" }
  const initial = createChatState(
    snapshot({ messages, conversation, pagination })
  )
  const event = receipt([messages[3]], {
    readerId: counterpartId,
    throughMinute: 4,
  })
  const live = receiveReadReceipt(initial, event, currentUserId)

  const state = reconcileChatState(
    live,
    snapshot({
      messages: messages.slice(2),
      conversation,
      pagination: { has_more: true, next_cursor: "before-m3" },
    })
  )

  assert.deepEqual(
    state.selectedConversation.messages.map(({ id }) => id),
    ["m1", "m2", "m3", "m4"]
  )
  assert.equal(state.selectedConversation.messages[3].read_at, event.read_at)
  assert.equal(state.knownMessages.get("m4").read_at, event.read_at)
  assert.equal(state.readReceipts.size, 1)
  assert.deepEqual(state.selectedConversation.messages_pagination, pagination)
})

test("a reconnect snapshot without overlap uses its fresh cursor so the missing gap can be fetched", () => {
  const loaded = [message("m1", 1), message("m2", 2)]
  const fresh = [message("m8", 8), message("m9", 9)]
  const initial = createChatState(snapshot({ messages: loaded }))
  const freshPagination = { has_more: true, next_cursor: "before-m8" }

  const state = reconcileChatState(
    initial,
    snapshot({
      messages: fresh,
      conversation: summary({
        last_message: fresh[1].body,
        updated_at: timestamp(9),
      }),
      pagination: freshPagination,
    })
  )

  assert.deepEqual(
    state.selectedConversation.messages.map(({ id }) => id),
    ["m1", "m2", "m8", "m9"]
  )
  assert.deepEqual(
    state.selectedConversation.messages_pagination,
    freshPagination
  )
  assert.equal(state.conversations[0].last_message, fresh[1].body)
})
