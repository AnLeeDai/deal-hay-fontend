import type { Metadata } from "next"

import { requireAuth } from "@/lib/auth"
import { NotificationsPageContainer } from "@/modules/notifications/containers/notifications-page-container"

export const metadata: Metadata = { title: "Thông báo" }

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireAuth()
  const { page } = await searchParams
  return <NotificationsPageContainer page={page} />
}
