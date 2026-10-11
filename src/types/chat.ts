export type ProductReference = {
  id: string
  shop_code: string
  slug: string
  name: string
  sku: string | null
  price: number
  variant_id: string | null
  variant_label: string | null
  option_values: Record<string, string>
  image_url: string | null
  is_available: boolean
}

export type ChatAttachment = {
  url: string
  name: string
  mime: string
  size: number
  type: "image" | "video" | "file"
}

export type ChatMessage = {
  id: string
  conversation_id: string
  body: string
  read_at: string | null
  attachment: ChatAttachment | null
  product: ProductReference | null
  sender: {
    id: string
    name: string
    avatar_url: string | null
  }
  created_at: string | null
  client_message_id?: string | null
  replayed?: boolean
}

export type ConversationSummary = {
  id: string
  slug: string
  counterpart: {
    id: string
    name: string
    avatar_url: string | null
    is_online: boolean
    is_shop: boolean
  }
  last_message: string | null
  unread_count: number
  updated_at: string | null
}

export type SelectedConversation = ConversationSummary & {
  messages: ChatMessage[]
  messages_pagination: {
    has_more: boolean
    next_cursor: string | null
  }
}
