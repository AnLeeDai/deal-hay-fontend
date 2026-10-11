import type { User } from "@/types/auth"
import type { Ticket } from "@/types/ticket"

export type AdminShopOnlineStatus = {
  is_online: boolean
  label: string
  last_activity_at: number | null
}

export type AdminShopCategory = {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

export type AdminShopProduct = {
  id: string
  name: string
  category: string
  description: string | null
  price: number
  stock: number
  label: string | null
  image_url: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export type AdminShopChangeLog = {
  id: string
  changes: Record<
    string,
    {
      label: string
      old: string | number | boolean | null
      new: string | number | boolean | null
    }
  >
  created_at: string | null
}

export type AdminShop = {
  id: string
  role: "shop_owner"
  user_code: string
  full_name: string
  shop_name: string | null
  email: string
  shop_email: string | null
  phone_number: string | null
  shop_phone_number: string | null
  avatar_url: string | null
  shop_avatar_url: string | null
  province: string | null
  ward: string | null
  address_detail: string | null
  personal_address: string
  shop_province: string | null
  shop_ward: string | null
  shop_address_detail: string | null
  shop_address: string
  is_active: boolean
  lock_reason: string | null
  products_count: number
  categories_count: number
  change_logs_count: number
  online_status: AdminShopOnlineStatus
  created_at: string | null
  updated_at: string | null
  categories?: AdminShopCategory[]
  products?: AdminShopProduct[]
  change_logs?: AdminShopChangeLog[]
}

export type ProductCategory = {
  id: string
  name: string
  is_active: boolean
  products_count: number
  shops_count: number
}

export type AdminUsersResponse = {
  users: import("@/types/common").PaginatedResponse<User>
}
export type AdminShopsResponse = {
  filters: { search: string; status: string }
  selectedShop: AdminShop | null
  shops: import("@/types/common").PaginatedResponse<AdminShop>
}
export type AdminTicketsResponse = {
  filters: { type: string | null; status: string | null; source: string | null }
  selectedTicket: Ticket | null
  tickets: import("@/types/common").PaginatedResponse<Ticket>
}
export type AdminCategoriesResponse = { categories: ProductCategory[] }
