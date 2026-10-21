import type { Metadata } from "next"

import { requireAuth } from "@/lib/auth"
import { ShopManagementPageContainer } from "@/modules/shop-management/containers/shop-management-page-container"

export const metadata: Metadata = { title: "Quản lý shop" }

export default async function ShopManagePage() {
  await requireAuth()
  return <ShopManagementPageContainer />
}
