import type { Metadata } from "next"

import { requireAuth } from "@/lib/auth"
import { SellPageContainer } from "@/modules/selling/containers/sell-page-container"

export const metadata: Metadata = { title: "Bán hàng" }

export default async function SellPage() {
  const user = await requireAuth()
  return <SellPageContainer user={user} />
}
