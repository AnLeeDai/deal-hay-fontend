import { formatCurrency } from "@/lib/format"
import type { ProductDiscountCode } from "@/types/discount-code"

export function formatDiscountCodeValue(code: ProductDiscountCode): string {
  if (code.reward_type === "fixed") {
    return formatCurrency(code.fixed_amount ?? code.reward_value ?? 0)
  }
  if (code.reward_type === "percentage") {
    return `${(code.reward_value ?? 0) / 100}%`
  }
  return `${code.discount_percent}%`
}
