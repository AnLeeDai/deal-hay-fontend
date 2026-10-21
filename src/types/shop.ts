import type {
  ProductOption,
  ProductVariant,
  ProductReview,
} from "@/types/catalog"

export type ShopProductImage = {
  id: string
  image_url: string
  display_order: number
}

export type ShopProductVariant = ProductVariant & {
  id: string
  sku: string
  variant_label?: string | null
  retired_at?: string | null
}

export type ShopProduct = {
  id: string
  slug?: string
  sku: string | null
  name: string
  category: string
  description: string | null
  price: number
  old_price?: number | null
  video_url?: string | null
  stock: number
  has_variants: boolean
  label: string | null
  image_url: string | null
  is_active: boolean
  images: ShopProductImage[]
  options: ProductOption[]
  variants: ShopProductVariant[]
  retired_variants: ShopProductVariant[]
}

export type ShopCoupon = {
  id: string
  code: string
  name: string
  discount_type: "fixed" | "percent"
  discount_value: number
  minimum_order_amount: number
  maximum_discount_amount: number | null
  usage_limit: number | null
  used_count: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

export type ShopOrderItem = {
  id: string
  product_name: string
  variant_name: string | null
  quantity: number
  unit_price: number
  subtotal: number
}

export type ShopOrder = {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  shipping_address: string
  status:
    | "pending"
    | "confirmed"
    | "processing"
    | "shipping"
    | "completed"
    | "cancelled"
  subtotal: number
  discount_amount: number
  shipping_fee?: number
  shipping_discount_amount?: number
  shipping_total?: number
  total: number
  note: string | null
  created_at: string | null
  items: ShopOrderItem[]
}

export type InventoryMovement = {
  id: string
  product_name: string
  variant_name: string | null
  type: string
  quantity_delta: number
  stock_after: number
  note: string | null
  created_at: string | null
}

export type ShopCategory = {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

export type ShopMetrics = {
  products_count: number
  total_products_count: number
  hidden_products_count: number
  followers_count: number
  likes_count: number
  dislikes_count: number
  reactions_count: number
  satisfaction_rate: number | null
  response_rate: number | null
  customer_conversations_count: number
  responded_conversations_count: number
  total_orders_count: number
  completed_orders_count: number
  open_orders_count: number
  total_revenue: number
  total_stock: number
  active_coupons_count: number
}

export type ShopProductReview = ProductReview & {
  product: NonNullable<ProductReview["product"]>
}
