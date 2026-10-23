"use server"

import { z } from "zod"

import { ApiError, apiFetch } from "@/api/client"
import type {
  InventoryUnitFilters,
  InventoryUnitPage,
} from "@/types/inventory-unit"

const filtersSchema = z.object({
  page: z.number().int().min(1).max(1_000_000).default(1),
  per_page: z.number().int().min(1).max(200).default(100),
  search: z.string().trim().max(200).optional(),
  product_id: z.uuid().optional(),
})

export async function listInventoryUnitsAction(
  filters: InventoryUnitFilters = {}
): Promise<
  | { success: true; data: InventoryUnitPage }
  | { success: false; message: string }
> {
  const parsed = filtersSchema.safeParse(filters)
  if (!parsed.success) {
    return { success: false, message: "Bộ lọc đơn vị hàng hóa không hợp lệ." }
  }
  try {
    const data = await apiFetch<InventoryUnitPage>({
      path: "/private/shop/inventory-units",
      searchParams: parsed.data,
    })
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? (Object.values(error.errors ?? {}).flat()[0] ?? error.message)
          : "Không thể tải danh sách đơn vị hàng hóa. Vui lòng thử lại.",
    }
  }
}
