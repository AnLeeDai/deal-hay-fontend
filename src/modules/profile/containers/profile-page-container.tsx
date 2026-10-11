import { redirect } from "next/navigation"

import { getProfile } from "@/api/profile/queries"
import { ProfilePageClient } from "@/modules/profile/components/profile-page-client"

export async function ProfilePageContainer({ tab }: { tab?: string }) {
  const response = await getProfile()
  if (!response.auth.user) {
    redirect("/sign-in")
  }
  if (tab === "seller") {
    if (response.auth.user.role === "shop_owner") {
      redirect("/shop-manage")
    }
    if (response.auth.user.role === "administrator") {
      redirect("/admin/shops")
    }
  }
  return <ProfilePageClient tab={tab} user={response.auth.user} />
}
