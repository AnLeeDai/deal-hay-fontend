import type { Metadata } from "next"

import { requireAuth } from "@/lib/auth"
import { ProfilePageContainer } from "@/modules/profile/containers/profile-page-container"

export const metadata: Metadata = { title: "Hồ sơ của tôi" }

export default async function ProfilePage() {
  await requireAuth()
  return <ProfilePageContainer />
}
