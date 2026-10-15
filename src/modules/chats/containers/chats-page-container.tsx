import { getChats } from "@/api/chats/queries"
import { ChatsPageClient } from "@/modules/chats/components/chats-page-client"

export async function ChatsPageContainer({
  conversationSlug,
  currentUserId,
}: {
  conversationSlug?: string
  currentUserId: string
}) {
  const data = await getChats(conversationSlug, 50)

  return (
    <ChatsPageClient
      key={data.selectedConversation?.id ?? "list"}
      conversations={data.conversations}
      currentUserId={currentUserId}
      selectedConversation={data.selectedConversation}
    />
  )
}
