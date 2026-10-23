"use server"

import { revalidatePath } from "next/cache"
import { ApiError, apiFetch } from "@/api/client"
import {
  shopCouponSchema,
  type ShopCouponValues,
} from "@/modules/shop-management/schemas/shop-coupon"
import type { ActionState } from "@/types/forms"

export async function saveShopCouponAction(
  values: ShopCouponValues,
  id?: string
): Promise<ActionState> {
  const parsed = shopCouponSchema.safeParse(values)
  if (!parsed.success)
    return {
      success: false,
      message: "Vui lòng kiểm tra thông tin ưu đãi.",
      errors: parsed.error.flatten().fieldErrors,
    }
  try {
    const response = await apiFetch<{ message: string }>({
      method: id ? "PATCH" : "POST",
      path: id
        ? `/private/shop/coupons/${encodeURIComponent(id)}`
        : "/private/shop/coupons",
      body: parsed.data,
    })
    revalidatePath("/shop-manage")
    return { success: true, message: response.message }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError ? error.message : "Không lưu được ưu đãi.",
      errors: error instanceof ApiError ? error.errors : undefined,
    }
  }
}

export async function removeShopCouponAction(id: string): Promise<ActionState> {
  try {
    const response = await apiFetch<{ message: string }>({
      method: "DELETE",
      path: `/private/shop/coupons/${encodeURIComponent(id)}`,
    })
    revalidatePath("/shop-manage")
    return { success: true, message: response.message }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.errors?.coupon?.[0] || error.message
          : "Không xóa được ưu đãi.",
    }
  }
}
