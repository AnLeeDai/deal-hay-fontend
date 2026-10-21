import type { Metadata } from "next"

import { requireAuth } from "@/lib/auth"
import { ChatsPageContainer } from "@/modules/chats/containers/chats-page-container"

export const metadata: Metadata = { title: "Cuộc trò chuyện" }

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationSlug: string }>
}) {
  const user = await requireAuth()
  const { conversationSlug } = await params
  return (
    <ChatsPageContainer
      conversationSlug={conversationSlug}
      currentUserId={user.id}
    />
  )
}
