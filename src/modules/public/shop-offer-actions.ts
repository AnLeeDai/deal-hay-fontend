"use server"

import { ApiError, apiFetch } from "@/api/client"
import type { ShopOffer } from "@/types/shop-coupon"
import type { ActionState } from "@/types/forms"

export async function loadShopOffersAction(
  shopCode: string,
  productId?: string
): Promise<ActionState & { data?: ShopOffer[] }> {
  try {
    const result = await apiFetch<{ coupons: ShopOffer[] }>({
      path: `/shops/${encodeURIComponent(shopCode)}/coupons`,
      searchParams: { product_id: productId },
    })
    return {
      success: true,
      message: "Đã tải ưu đãi từ shop.",
      data: result.coupons,
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.message
          : "Không tải được ưu đãi từ shop.",
    }
  }
}
