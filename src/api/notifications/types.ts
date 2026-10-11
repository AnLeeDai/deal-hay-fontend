import type { AppNotification } from "@/types/notification"
import type { PaginatedResponse } from "@/types/common"

export type NotificationsResponse = {
  notification_page: PaginatedResponse<AppNotification>
}
