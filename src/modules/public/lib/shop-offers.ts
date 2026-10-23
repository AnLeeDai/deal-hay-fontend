import type { ShopOffer } from "@/types/shop-coupon"

export function shopOfferDiscount(
  offer: ShopOffer | undefined,
  subtotal: number,
  remaining = subtotal,
  now = Date.now()
): number {
  if (
    !offer ||
    subtotal < offer.minimum_order_amount ||
    remaining <= 0 ||
    offer.remaining_uses === 0 ||
    (offer.starts_at && new Date(offer.starts_at).getTime() > now) ||
    (offer.ends_at && new Date(offer.ends_at).getTime() <= now)
  )
    return 0
  const discount =
    offer.discount_type === "percent"
      ? Math.floor((remaining * offer.discount_value) / 100)
      : offer.discount_value
  return Math.max(
    0,
    Math.min(remaining, discount, offer.maximum_discount_amount ?? discount)
  )
}
