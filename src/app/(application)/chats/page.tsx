import type { Metadata } from "next"

import { requireAuth } from "@/lib/auth"
import { ChatsPageContainer } from "@/modules/chats/containers/chats-page-container"

export const metadata: Metadata = { title: "Tin nhắn" }

export default async function ChatsPage() {
  const user = await requireAuth()
  return <ChatsPageContainer currentUserId={user.id} />
}
