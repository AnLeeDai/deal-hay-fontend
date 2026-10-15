import { getCurrentSession } from "@/api/auth/queries"
import { getNotifications } from "@/api/notifications/queries"
import { NotificationsPageClient } from "@/modules/notifications/components/notifications-page-client"

export async function NotificationsPageContainer({ page }: { page?: string }) {
  const [data, session] = await Promise.all([
    getNotifications(page),
    getCurrentSession(),
  ])
  return (
    <NotificationsPageClient
      key={data.notification_page.current_page ?? 1}
      currentUserId={session.user?.id}
      page={data.notification_page}
    />
  )
}
