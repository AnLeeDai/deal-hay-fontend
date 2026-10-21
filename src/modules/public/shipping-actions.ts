"use server"

import { ApiError, apiFetch } from "@/api/client"
import type { ActionState } from "@/types/forms"
import type { ShippingQuote } from "@/types/shipping"

export async function loadShippingQuoteAction(
  shopCode: string,
  productSlug: string,
  provinceCode: string,
  wardCode: string
): Promise<ActionState & { data?: ShippingQuote }> {
  const province = Number(provinceCode)
  const ward = Number(wardCode)
  if (
    !/^\d+$/.test(provinceCode) ||
    !/^\d+$/.test(wardCode) ||
    !Number.isSafeInteger(province) ||
    !Number.isSafeInteger(ward) ||
    province <= 0 ||
    ward <= 0
  ) {
    return {
      success: false,
      message: "Vui lòng chọn địa chỉ giao hàng hợp lệ.",
    }
  }

  try {
    const response = await apiFetch<{ shipping_quote: ShippingQuote }>({
      method: "POST",
      path: `/shops/${encodeURIComponent(shopCode)}/products/${encodeURIComponent(productSlug)}/shipping-quote`,
      body: {
        shipping_province_code: province,
        shipping_ward_code: ward,
      },
      cache: "no-store",
    })
    return { success: true, message: "", data: response.shipping_quote }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.message
          : "Chưa lấy được phí vận chuyển. Vui lòng thử lại.",
    }
  }
}
