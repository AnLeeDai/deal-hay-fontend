import { getChats, getRealtimeConfig } from "@/api/chats/queries"
import { ChatsPageClient } from "@/modules/chats/components/chats-page-client"

export async function ChatsPageContainer({
  conversationSlug,
  currentUserId,
}: {
  conversationSlug?: string
  currentUserId: string
}) {
  const [data, realtimeConfig] = await Promise.all([
    getChats(conversationSlug, 50),
    getRealtimeConfig(),
  ])
  const renderKey = [
    data.selectedConversation?.id ?? "list",
    data.selectedConversation?.messages.at(-1)?.id ?? "empty",
    data.conversations.at(0)?.updated_at ?? "none",
  ].join(":")

  return (
    <ChatsPageClient
      key={renderKey}
      conversations={data.conversations}
      currentUserId={currentUserId}
      realtimeConfig={realtimeConfig}
      selectedConversation={data.selectedConversation}
    />
  )
}
