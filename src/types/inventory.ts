export type StocktakeItem = {
  id: string
  code: string
  sku: string | null
  product_name: string
  variant_name: string | null
  expected_quantity: number
  counted_quantity: number
  difference: number
  is_unknown: boolean
  result: "matched" | "surplus" | "shortage" | "unknown"
  shortage_quantity?: number
  surplus_quantity?: number
  unit_price?: number | null
  values?: Pick<
    StocktakeFinancialSummary,
    "expected_value" | "counted_value" | "shortage_value" | "surplus_value"
  > | null
  units?: StocktakeUnit[]
  units_total?: number
}

export type StocktakeSummary = {
  id: string
  name: string
  status: "counting" | "completed"
  stock_adjusted: boolean
  created_at: string | null
  completed_at: string | null
  counting_mode: "serialized" | "legacy"
  saved_at: string | null
  confirmed_at?: string | null
  financial_summary?: StocktakeFinancialSummary | null
}

export type Stocktake = StocktakeSummary & {
  summary: {
    expected: number
    counted: number
    shortage: number
    surplus: number
    unknown: number
  }
  items: StocktakeItem[]
  financial_summary: StocktakeFinancialSummary | null
  confirmation_token: string | null
  confirmed_by?: string | null
  valuation_basis?: "sale_price"
}
export type StocktakeUnit = {
  id: string
  inventory_unit_id: string
  sku: string
  code: string
  expected: boolean
  counted: boolean
}

export type StocktakeFinancialSummary = {
  expected_value: number
  counted_value: number
  shortage_value: number
  surplus_value: number
  net_difference_value: number
  debt_amount: number
}
