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
}

export type StocktakeSummary = {
  id: string
  name: string
  status: "counting" | "completed"
  stock_adjusted: boolean
  created_at: string | null
  completed_at: string | null
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
}
