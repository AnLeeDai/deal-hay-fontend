import { getCurrentSession } from "@/api/auth/queries"
import { getRealtimeConfig } from "@/api/chats/queries"
import type { RealtimeConfig } from "@/api/chats/types"
import { RealtimeProvider } from "@/components/realtime-provider"

export async function RealtimeRoot({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, unreadCounts } = await getCurrentSession()
  let config: RealtimeConfig | null = null

  if (user) {
    try {
      config = await getRealtimeConfig()
    } catch {
      // A realtime outage must not prevent the rest of the app from rendering.
    }
  }

  return (
    <RealtimeProvider
      key={user?.id ?? "guest"}
      config={config}
      currentUserId={user?.id}
      initialUnreadCounts={unreadCounts}
    >
      {children}
    </RealtimeProvider>
  )
}
