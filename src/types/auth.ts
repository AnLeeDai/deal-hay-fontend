export type UserRole = "administrator" | "shop_owner" | "customer" | string

export type User = {
  id: string
  role: UserRole
  user_code: string
  full_name: string
  shop_name: string | null
  email: string
  shop_email: string | null
  phone_number: string | null
  shop_phone_number: string | null
  shop_avatar_url: string | null
  shop_province: string | null
  shop_ward: string | null
  shop_address_detail: string | null
  province: string | null
  ward: string | null
  address_detail: string | null
  avatar_url: string | null
  is_active: number | boolean
  lock_reason: string | null
  email_verified_at: string | null
  created_at: string | null
  updated_at: string | null
  online_status?: {
    is_online: boolean
    label: string
    last_activity_at: number | null
  }
}

export type AuthPayload = {
  message: string
  token: string
  user: User
}

export type UnreadCounts = {
  messages: number
  notifications: number
}

export type SessionUser = {
  user: User | null
  unreadCounts: UnreadCounts
}
