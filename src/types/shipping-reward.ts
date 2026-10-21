export type ShippingOffer = {
  available: boolean
  unavailable_reason: string | null
}

export type ShippingRewardView = {
  id: string
  expires_at: string
}

export type ShippingDiscountCode = {
  id: string
  code: string
  expires_at: string
  used_at: string | null
  is_available: boolean
  product_id: string
  discount_percent: 100
}
