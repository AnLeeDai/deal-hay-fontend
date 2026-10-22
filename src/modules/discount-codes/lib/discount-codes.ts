import { productCheckoutHref } from "@/modules/public/lib/product-checkout"
import type { ProductDiscountCode } from "@/types/discount-code"

export function discountCodeUnitPrice(
  regularPrice: number,
  code: Pick<ProductDiscountCode, "original_price" | "sale_price">
): number {
  if (
    !Number.isSafeInteger(regularPrice) ||
    regularPrice < 0 ||
    !Number.isSafeInteger(code.original_price) ||
    code.original_price < 1 ||
    !Number.isSafeInteger(code.sale_price) ||
    code.sale_price < 0 ||
    code.sale_price > code.original_price
  )
    return regularPrice
  const original = BigInt(code.original_price)
  const numerator = BigInt(regularPrice) * BigInt(code.sale_price)
  return Math.min(
    regularPrice,
    Number((numerator + original / BigInt(2)) / original)
  )
}

export function summarizeDiscountCodes(
  regularUnitPrice: number,
  quantity: number,
  codes: ProductDiscountCode[]
): {
  subtotal: number
  discount: number
  total: number
  appliedCodes: ProductDiscountCode[]
} {
  if (
    !Number.isSafeInteger(regularUnitPrice) ||
    regularUnitPrice < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    !Number.isSafeInteger(regularUnitPrice * quantity)
  )
    return { subtotal: 0, discount: 0, total: 0, appliedCodes: [] }

  const subtotal = BigInt(regularUnitPrice) * BigInt(quantity)
  let remaining = subtotal
  const appliedCodes: ProductDiscountCode[] = []
  const seen = new Set<string>()

  for (const code of codes) {
    if (remaining === BigInt(0)) break
    if (!code.is_available || seen.has(code.id)) continue
    seen.add(code.id)

    let amount = BigInt(0)
    if (code.reward_type === "fixed") {
      const value = code.fixed_amount ?? code.reward_value
      if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
        amount = BigInt(value)
    } else if (code.reward_type === "percentage") {
      const value = code.reward_value
      if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
        amount = (subtotal * BigInt(value) + BigInt(5000)) / BigInt(10000)
    } else if (!code.reward_type || code.reward_type === "legacy_ratio") {
      amount =
        BigInt(
          regularUnitPrice - discountCodeUnitPrice(regularUnitPrice, code)
        ) * BigInt(quantity)
    }

    if (amount <= BigInt(0)) continue
    remaining -= amount < remaining ? amount : remaining
    appliedCodes.push(code)
  }

  return {
    subtotal: Number(subtotal),
    discount: Number(subtotal - remaining),
    total: Number(remaining),
    appliedCodes,
  }
}

export function discountCodeCanBeSaved(
  code: Pick<ProductDiscountCode, "saved_at" | "used_at" | "expires_at">,
  now = Date.now()
): boolean {
  return (
    !code.saved_at && !code.used_at && new Date(code.expires_at).getTime() > now
  )
}

export function discountCodeProductHref(code: ProductDiscountCode): string {
  return productCheckoutHref(code.product.shop.code, code.product.slug, {
    discountCode: code.code,
  })
}
