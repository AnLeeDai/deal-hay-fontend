import { getDiscountCodes } from "@/api/discount-codes/queries"
import { DiscountCodesPageClient } from "@/modules/discount-codes/components/discount-codes-page-client"

export async function DiscountCodesPageContainer() {
  const response = await getDiscountCodes()
  return <DiscountCodesPageClient codes={response.discount_codes} />
}
