"use server"

import { revalidatePath } from "next/cache"

import { ApiError } from "@/api/client"
import { getCurrentSession } from "@/api/auth/queries"
import {
  createTicket,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/api/notifications/mutations"
import { getNotifications } from "@/api/notifications/queries"
import type { PaginatedResponse } from "@/types/common"
import type { ActionState } from "@/types/forms"
import type { AppNotification } from "@/types/notification"
import {
  notificationAppealSchema,
  type NotificationAppealValues,
} from "@/modules/notifications/schemas/notifications"

export async function markAllNotificationsReadAction(): Promise<void> {
  await markAllNotificationsRead()
}

export async function markNotificationReadAction(
  notificationId: string
): Promise<void> {
  await markNotificationRead(notificationId)
}

export async function synchronizeNotificationsAction(
  page: number
): Promise<PaginatedResponse<AppNotification> | null> {
  try {
    const response = await getNotifications(
      String(Math.max(1, Math.trunc(page)))
    )
    return response.notification_page
  } catch {
    return null
  }
}

export async function notificationAppealAction(
  values: NotificationAppealValues
): Promise<ActionState> {
  const session = await getCurrentSession()
  const user = session.user
  if (!user) {
    return { success: false, message: "Vui lòng đăng nhập lại." }
  }

  const parsed = notificationAppealSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại nội dung khiếu nại.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const response = await createTicket({
      user_id: user.id,
      type: "notification_appeal",
      source: "notification_center",
      message: parsed.data.message,
      notification_id: parsed.data.notification_id,
    })
    revalidatePath("/notifications")
    return { success: true, message: response.message }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message, errors: error.errors }
    }
    return { success: false, message: "Không thể gửi khiếu nại." }
  }
}
