import type { ProductDiscountCode } from "@/types/discount-code"

export type RewardedTaskConfig = {
  enabled: boolean
  reward_amount: number
  reason?: string
}

export type RewardedTaskSession = {
  id: string
  status: "pending" | "rewarded" | "expired"
  reward_amount: number
  expires_at: string
  offerwall_url: string
  discount_codes: ProductDiscountCode[]
}
