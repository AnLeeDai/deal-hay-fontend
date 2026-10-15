import { apiFetch } from "@/api/client"
import type { ProductDiscountCode } from "@/types/discount-code"

export function getDiscountCodes(
  productId?: string
): Promise<{ discount_codes: ProductDiscountCode[] }> {
  return apiFetch({
    path: "/discount-codes",
    searchParams: { product_id: productId },
  })
}
