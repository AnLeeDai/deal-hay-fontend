export type ShippingSettings = {
  enabled: boolean
  base_fee: number
  ward_rates: Array<{ ward_code: number; fee: number }>
}

export type ShippingQuote = {
  eligible: boolean
  configured: boolean
  fee: number | null
  province_code: number
  ward_code: number
  reason: "outside_hanoi" | "not_configured" | null
}
