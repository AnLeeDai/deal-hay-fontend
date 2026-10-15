"use server"

import { revalidatePath } from "next/cache"
import { ApiError, apiFetch } from "@/api/client"
import { getDiscountCodes } from "@/api/discount-codes/queries"
import type { ProductDiscountCode } from "@/types/discount-code"
import type { ActionState } from "@/types/forms"

export async function loadDiscountCodesAction(
  productId?: string
): Promise<ActionState & { data?: ProductDiscountCode[] }> {
  try {
    const response = await getDiscountCodes(productId)
    return {
      success: true,
      message: "Đã tải mã giảm giá.",
      data: response.discount_codes,
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.status === 401
            ? "Vui lòng đăng nhập để xem và sử dụng mã giảm giá."
            : error.message
          : "Không tải được mã giảm giá. Vui lòng thử lại.",
    }
  }
}

export async function saveDiscountCodeAction(
  codeId: string
): Promise<ActionState & { data?: ProductDiscountCode }> {
  try {
    const response = await apiFetch<{
      message: string
      discount_code: ProductDiscountCode
    }>({
      method: "POST",
      path: `/discount-codes/${encodeURIComponent(codeId)}/save`,
    })
    revalidatePath("/discount-codes")
    return {
      success: true,
      message: response.message,
      data: response.discount_code,
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.message
          : "Không lưu được mã giảm giá. Vui lòng thử lại.",
    }
  }
}
