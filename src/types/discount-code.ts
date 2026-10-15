export type ProductDiscountCode = {
  id: string
  code: string
  discount_percent: number
  reward_type?: "fixed" | "percentage" | "legacy_ratio"
  reward_value?: number | null
  fixed_amount?: number | null
  original_price: number
  sale_price: number
  expires_at: string
  saved_at: string | null
  used_at: string | null
  is_available: boolean
  product: {
    id: string
    name: string
    slug: string
    image_url: string | null
    shop: {
      code: string
      name: string
    }
  }
}
