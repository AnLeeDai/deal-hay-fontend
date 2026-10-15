import { apiFetch } from "@/api/client"
import { adminRoutes } from "@/api/admin/routes"
import type { ApiMessageResponse } from "@/types/common"
import type { ConversationSummary } from "@/types/chat"

export function startAdminChat(
  userId: string
): Promise<{ conversation: ConversationSummary }> {
  return apiFetch({ method: "POST", path: adminRoutes.startChat(userId) })
}

export function toggleUserLock(
  userId: string,
  payload: { action: "lock" | "unlock"; lock_reason?: string | null }
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "PATCH",
    path: adminRoutes.toggleUserLock(userId),
    body: payload,
  })
}

export function createCategory(payload: {
  name: string
  is_active?: boolean
}): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "POST",
    path: adminRoutes.categories,
    body: payload,
  })
}

export function updateCategory(
  categoryId: string,
  payload: { name: string; is_active?: boolean }
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "PATCH",
    path: adminRoutes.category(categoryId),
    body: payload,
  })
}

export function deleteCategory(
  categoryId: string
): Promise<ApiMessageResponse> {
  return apiFetch({ method: "DELETE", path: adminRoutes.category(categoryId) })
}

export function reviewTicket(
  ticketId: string,
  payload: { status: "approved" | "rejected"; admin_note?: string | null }
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "PATCH",
    path: adminRoutes.ticket(ticketId),
    body: payload,
  })
}

export function deleteShopProduct(
  shopId: string,
  productId: string,
  reason: string
): Promise<ApiMessageResponse> {
  return apiFetch({
    method: "DELETE",
    path: adminRoutes.shopProduct(shopId, productId),
    body: { reason },
  })
}
