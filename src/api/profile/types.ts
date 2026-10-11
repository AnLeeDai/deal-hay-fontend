import type { User } from "@/types/auth"
import type {
  InventoryMovement,
  ShopCategory,
  ShopCoupon,
  ShopMetrics,
  ShopOrder,
  ShopProduct,
  ShopProductReview,
} from "@/types/shop"

export type ProfileResponse = { auth: { user: User } }
export type ShopManageResponse = {
  shop: Record<string, unknown> | null
  categories: ShopCategory[]
  products: ShopProduct[]
  coupons: ShopCoupon[]
  orders: ShopOrder[]
  metrics?: ShopMetrics
  shopMetrics?: ShopMetrics
  inventoryMovements?: InventoryMovement[]
  productReviews?: ShopProductReview[]
  auth?: { user: User }
}
