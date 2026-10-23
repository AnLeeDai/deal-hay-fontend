"use server"

import { z } from "zod"

import { ApiError, apiFetch } from "@/api/client"
import type { StocktakeUnit } from "@/types/inventory"

export type StocktakeUnitPage = {
  data: StocktakeUnit[]
  meta: {
    current_page: number
    last_page: number
    total: number
    per_page: number
  }
}

const requestSchema = z.object({
  stocktakeId: z.uuid(),
  itemId: z.uuid(),
  page: z.number().int().min(1).max(1_000_000),
  perPage: z.number().int().min(1).max(100),
})

export async function listStocktakeUnitsAction(
  stocktakeId: string,
  itemId: string,
  page = 1,
  perPage = 100
): Promise<
  | { success: true; data: StocktakeUnitPage }
  | { success: false; message: string }
> {
  const parsed = requestSchema.safeParse({ stocktakeId, itemId, page, perPage })
  if (!parsed.success) {
    return {
      success: false,
      message: "Phiên, mặt hàng hoặc trang chi tiết không hợp lệ.",
    }
  }
  try {
    const data = await apiFetch<StocktakeUnitPage>({
      path: `/private/shop/stocktakes/${parsed.data.stocktakeId}/items/${parsed.data.itemId}/units`,
      searchParams: { page: parsed.data.page, per_page: parsed.data.perPage },
    })
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? (Object.values(error.errors ?? {}).flat()[0] ?? error.message)
          : "Không thể tải chi tiết mã đơn vị. Vui lòng thử lại.",
    }
  }
}
