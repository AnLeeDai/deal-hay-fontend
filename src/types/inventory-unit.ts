export type InventoryUnit = {
  id: string
  code: string
  sku: string
  shop_product_id: string
  shop_product_variant_id: string | null
  product_name: string
  variant_name: string | null
  stock: 1
  is_active: boolean
  price: number
  status: "available" | "removed"
}

export type InventoryUnitPage = {
  data: InventoryUnit[]
  meta: {
    current_page: number
    last_page: number
    total: number
    per_page: number
  }
}

export type InventoryUnitFilters = {
  page?: number
  per_page?: number
  search?: string
  product_id?: string
}
