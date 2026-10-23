"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ApiError, apiFetch } from "@/api/client"
import type { Stocktake, StocktakeSummary } from "@/types/inventory"
import { normalizeInventoryScanCode } from "@/modules/shop-management/lib/inventory-scan"

type Result<T> =
  { success: true; data: T } | { success: false; message: string }
const uuid = z.uuid()

function errorResult(error: unknown): { success: false; message: string } {
  return {
    success: false,
    message:
      error instanceof ApiError
        ? (Object.values(error.errors ?? {}).flat()[0] ?? error.message)
        : "Không thể kết nối kho hàng. Vui lòng thử lại.",
  }
}

export async function listStocktakesAction(): Promise<
  Result<StocktakeSummary[]>
> {
  try {
    const result = await apiFetch<{ data: StocktakeSummary[] }>({
      path: "/private/shop/stocktakes",
    })
    return { success: true, data: result.data }
  } catch (error) {
    return errorResult(error)
  }
}

export async function getStocktakeAction(
  id: string
): Promise<Result<Stocktake>> {
  if (!uuid.safeParse(id).success)
    return { success: false, message: "Phiên kiểm kê không hợp lệ." }
  try {
    const result = await apiFetch<{ data: Stocktake }>({
      path: `/private/shop/stocktakes/${id}`,
    })
    return { success: true, data: result.data }
  } catch (error) {
    return errorResult(error)
  }
}

export async function createStocktakeAction(
  name: string
): Promise<Result<Stocktake>> {
  const parsed = z.string().trim().min(1).max(120).safeParse(name)
  if (!parsed.success)
    return {
      success: false,
      message: "Nhập tên phiên kiểm kê (tối đa 120 ký tự).",
    }
  try {
    const result = await apiFetch<{ data: Stocktake }>({
      method: "POST",
      path: "/private/shop/stocktakes",
      body: { name: parsed.data },
    })
    return { success: true, data: result.data }
  } catch (error) {
    return errorResult(error)
  }
}

export async function scanStocktakeAction(
  id: string,
  code: string,
  quantity: number,
  scanId: string
): Promise<Result<Stocktake>> {
  const normalized = normalizeInventoryScanCode(code)
  if (
    !uuid.safeParse(id).success ||
    !uuid.safeParse(scanId).success ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 999999 ||
    !normalized ||
    normalized.length > 255
  )
    return { success: false, message: "Mã quét hoặc số lượng không hợp lệ." }
  try {
    const result = await apiFetch<{ data: Stocktake }>({
      method: "POST",
      path: `/private/shop/stocktakes/${id}/scan`,
      body: { code: normalized, quantity, scan_id: scanId },
    })
    return { success: true, data: result.data }
  } catch (error) {
    return errorResult(error)
  }
}

export async function updateStocktakeItemAction(
  id: string,
  itemId: string,
  count: number
): Promise<Result<Stocktake>> {
  if (
    !uuid.safeParse(id).success ||
    !uuid.safeParse(itemId).success ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > 999999
  )
    return { success: false, message: "Số thực đếm phải từ 0 đến 999999." }
  try {
    const result = await apiFetch<{ data: Stocktake }>({
      method: "PATCH",
      path: `/private/shop/stocktakes/${id}/items/${itemId}`,
      body: { counted_quantity: count },
    })
    return { success: true, data: result.data }
  } catch (error) {
    return errorResult(error)
  }
}

export async function completeStocktakeAction(
  id: string,
  adjustStock: boolean,
  confirmationToken: string | null,
  confirmed: boolean
): Promise<Result<Stocktake>> {
  if (!uuid.safeParse(id).success)
    return { success: false, message: "Phiên kiểm kê không hợp lệ." }
  try {
    const result = await apiFetch<{ data: Stocktake }>({
      method: "POST",
      path: `/private/shop/stocktakes/${id}/complete`,
      body: {
        adjust_stock: adjustStock,
        confirmation_token: confirmationToken,
        confirmed,
      },
    })
    if (adjustStock) {
      revalidatePath("/shop-manage")
      revalidatePath("/")
      revalidatePath("/shops", "layout")
    }
    return { success: true, data: result.data }
  } catch (error) {
    return errorResult(error)
  }
}

export async function saveStocktakeAction(
  id: string
): Promise<Result<Stocktake>> {
  if (!uuid.safeParse(id).success)
    return { success: false, message: "Phiên kiểm kê không hợp lệ." }
  try {
    const result = await apiFetch<{ data: Stocktake }>({
      method: "POST",
      path: `/private/shop/stocktakes/${id}/save`,
    })
    return { success: true, data: result.data }
  } catch (error) {
    return errorResult(error)
  }
}

export async function undoStocktakeUnitAction(
  id: string,
  unitId: string
): Promise<Result<Stocktake>> {
  if (!uuid.safeParse(id).success || !uuid.safeParse(unitId).success)
    return { success: false, message: "Mã kiểm kê không hợp lệ." }
  try {
    const result = await apiFetch<{ data: Stocktake }>({
      method: "PATCH",
      path: `/private/shop/stocktakes/${id}/units/${unitId}`,
      body: { counted: false },
    })
    return { success: true, data: result.data }
  } catch (error) {
    return errorResult(error)
  }
}
