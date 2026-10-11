import { apiFetch } from "@/api/client"
import { notificationRoutes } from "@/api/notifications/routes"
import type { ApiMessageResponse } from "@/types/common"

export function markAllNotificationsRead(): Promise<ApiMessageResponse> {
  return apiFetch({ method: "PATCH", path: notificationRoutes.readAll })
}

export function markNotificationRead(
  notificationId: string
): Promise<ApiMessageResponse> {
  return apiFetch({
    method: "PATCH",
    path: notificationRoutes.read(notificationId),
  })
}

export function createTicket(
  payload: Record<string, unknown>
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "POST",
    path: notificationRoutes.tickets,
    body: payload,
  })
}
