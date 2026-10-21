import type { Metadata } from "next"

import { requireAuth } from "@/lib/auth"
import { ProfilePageContainer } from "@/modules/profile/containers/profile-page-container"

export const metadata: Metadata = { title: "Hồ sơ của tôi" }

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireAuth()
  const { tab } = await searchParams
  return <ProfilePageContainer tab={tab} />
}
