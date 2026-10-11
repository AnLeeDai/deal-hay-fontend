import { redirect } from "next/navigation"

import { getProfile } from "@/api/profile/queries"
import { ProfilePageClient } from "@/modules/profile/components/profile-page-client"

export async function ProfilePageContainer() {
  const response = await getProfile()
  if (!response.auth.user) {
    redirect("/sign-in")
  }
  return <ProfilePageClient user={response.auth.user} />
}
