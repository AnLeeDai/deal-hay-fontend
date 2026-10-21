import type { Metadata } from "next"
import { requireAuth } from "@/lib/auth"
import { DiscountCodesPageContainer } from "@/modules/discount-codes/containers/discount-codes-page-container"

export const metadata: Metadata = { title: "Mã giảm giá của tôi" }

export default async function DiscountCodesPage() {
  await requireAuth("/discount-codes")
  return <DiscountCodesPageContainer />
}
