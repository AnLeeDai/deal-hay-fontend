export type TicketUser = {
  id: string
  full_name: string
  email: string
  user_code: string
  lock_reason: string | null
  avatar_url: string | null
}

export type TicketReviewer = {
  full_name: string
}

export type ShopOwnerUpgradeDetails = {
  full_name: string
  shop_name: string
  email: string
  shop_email: string
  phone_number: string
  shop_phone_number: string
  province: string
  ward: string
  address_detail: string
}

export type Ticket = {
  id: string
  type: string
  type_label: string
  source: string
  source_label: string
  message: string
  metadata: {
    source_url?: string | null
    submitted_from?: string | null
    lock_reason?: string | null
    notification_id?: string | null
    notification_title?: string | null
    shop_owner_upgrade?: ShopOwnerUpgradeDetails
  } | null
  status: "pending" | "approved" | "rejected"
  admin_note: string | null
  reviewed_at: string | null
  created_at: string | null
  user: TicketUser | null
  reviewer: TicketReviewer | null
}
