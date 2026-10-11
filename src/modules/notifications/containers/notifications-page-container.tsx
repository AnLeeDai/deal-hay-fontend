import { getNotifications } from "@/api/notifications/queries"
import { NotificationsPageClient } from "@/modules/notifications/components/notifications-page-client"

export async function NotificationsPageContainer({ page }: { page?: string }) {
  const data = await getNotifications(page)
  return <NotificationsPageClient page={data.notification_page} />
}
