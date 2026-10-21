"use server"

import { ApiError, apiFetch } from "@/api/client"
import type { ActionState } from "@/types/forms"
import type {
  ShippingDiscountCode,
  ShippingOffer,
  ShippingRewardView,
} from "@/types/shipping-reward"

function shippingOfferPath(shopCode: string, productSlug: string): string {
  return `/shops/${encodeURIComponent(shopCode)}/products/${encodeURIComponent(productSlug)}/shipping-offer`
}

function normalizeError(error: unknown): ActionState {
  if (error instanceof ApiError) {
    return {
      success: false,
      message:
        error.status === 401
          ? "Vui lòng đăng nhập để nhận mã miễn phí vận chuyển."
          : error.message,
      errors: error.errors,
    }
  }
  return {
    success: false,
    message: "Không thể xử lý ưu đãi vận chuyển. Vui lòng thử lại.",
  }
}

export async function loadShippingOfferAction(
  shopCode: string,
  productSlug: string
): Promise<ActionState & { data?: ShippingOffer }> {
  try {
    const response = await apiFetch<{ shipping_offer: ShippingOffer }>({
      method: "GET",
      path: shippingOfferPath(shopCode, productSlug),
      cache: "no-store",
    })
    return { success: true, message: "", data: response.shipping_offer }
  } catch (error) {
    return normalizeError(error)
  }
}

export async function loadShippingDiscountCodeAction(
  shopCode: string,
  productSlug: string
): Promise<ActionState & { data?: ShippingDiscountCode | null }> {
  try {
    const response = await apiFetch<{
      shipping_discount_code: ShippingDiscountCode | null
    }>({
      method: "GET",
      path: `${shippingOfferPath(shopCode, productSlug)}/code`,
      cache: "no-store",
    })
    return { success: true, message: "", data: response.shipping_discount_code }
  } catch (error) {
    return normalizeError(error)
  }
}

export async function startShippingRewardViewAction(
  shopCode: string,
  productSlug: string
): Promise<ActionState & { data?: ShippingRewardView }> {
  try {
    const response = await apiFetch<{ view: ShippingRewardView }>({
      method: "POST",
      path: `${shippingOfferPath(shopCode, productSlug)}/views`,
      cache: "no-store",
    })
    return { success: true, message: "", data: response.view }
  } catch (error) {
    return normalizeError(error)
  }
}

export async function redeemShippingRewardAction(
  shopCode: string,
  productSlug: string,
  viewId: string
): Promise<ActionState & { data?: ShippingDiscountCode }> {
  try {
    const response = await apiFetch<{
      message: string
      shipping_discount_code: ShippingDiscountCode
    }>({
      method: "POST",
      path: `${shippingOfferPath(shopCode, productSlug)}/views/${encodeURIComponent(viewId)}/redeem`,
      body: { rewarded_slot_granted: true },
      cache: "no-store",
    })
    return {
      success: true,
      message: response.message,
      data: response.shipping_discount_code,
    }
  } catch (error) {
    return normalizeError(error)
  }
}
