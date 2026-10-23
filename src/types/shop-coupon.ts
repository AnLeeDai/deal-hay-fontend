export type ShopOffer = {
  id: string
  code: string
  name: string
  discount_type: "fixed" | "percent"
  discount_value: number
  minimum_order_amount: number
  maximum_discount_amount: number | null
  remaining_uses: number | null
  starts_at: string | null
  ends_at: string | null
  products: Array<{ id: string; name: string; slug: string }>
}
