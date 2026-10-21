export type ShippingOffer = {
  available: boolean
  unavailable_reason: string | null
  rewarded_ad_unit_path: string | null
}

export type ShippingRewardView = {
  id: string
  expires_at: string
  rewarded_ad_unit_path: string
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
