import { apiFetch } from "@/api/client"
import { profileRoutes } from "@/api/profile/routes"
import type { ApiMessageResponse } from "@/types/common"

export function updateProfile(
  payload: Record<string, unknown>
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "PATCH",
    path: profileRoutes.updateMe,
    body: payload,
  })
}

export function updatePassword(
  payload: Record<string, unknown>
): Promise<ApiMessageResponse> {
  return apiFetch({
    method: "PATCH",
    path: profileRoutes.updatePassword,
    body: payload,
  })
}

export function updateAvatar(
  path: string,
  formData: FormData
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({ method: "POST", path, body: formData })
}

export function createShopOwnerUpgrade(
  payload: Record<string, unknown>
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "POST",
    path: profileRoutes.shopOwnerUpgrade,
    body: payload,
  })
}

export function updateShop(
  payload: Record<string, unknown>
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "PATCH",
    path: profileRoutes.updateShop,
    body: payload,
  })
}

export function createProduct(
  formData: FormData
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "POST",
    path: profileRoutes.shopProducts,
    body: formData,
  })
}

export function updateProduct(
  productId: string,
  formData: FormData
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "PATCH",
    path: profileRoutes.shopProduct(productId),
    body: formData,
  })
}

export function updateProductStatus(
  productId: string,
  isActive: boolean
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "PATCH",
    path: profileRoutes.shopProductStatus(productId),
    body: { is_active: isActive },
  })
}

export function deleteProduct(productId: string): Promise<ApiMessageResponse> {
  return apiFetch({
    method: "DELETE",
    path: profileRoutes.shopProduct(productId),
  })
}

export function adjustInventory(
  productId: string,
  payload: Record<string, unknown>
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "PATCH",
    path: profileRoutes.shopProductInventory(productId),
    body: payload,
  })
}

export function createCoupon(
  payload: Record<string, unknown>
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "POST",
    path: profileRoutes.shopCoupons,
    body: payload,
  })
}

export function updateCoupon(
  couponId: string,
  payload: Record<string, unknown>
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "PATCH",
    path: profileRoutes.shopCoupon(couponId),
    body: payload,
  })
}

export function deleteCoupon(couponId: string): Promise<ApiMessageResponse> {
  return apiFetch({
    method: "DELETE",
    path: profileRoutes.shopCoupon(couponId),
  })
}

export function updateOrderStatus(
  orderId: string,
  status: string
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "PATCH",
    path: profileRoutes.shopOrdersStatus(orderId),
    body: { status },
  })
}

export function reorderCategories(
  categoryIds: string[]
): Promise<ApiMessageResponse> {
  return apiFetch({
    method: "PATCH",
    path: profileRoutes.shopCategoriesReorder,
    body: { category_ids: categoryIds },
  })
}
