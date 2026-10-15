import { getAdminUsers } from "@/api/admin/queries"
import { AdminUsersClient } from "@/modules/admin/components/admin-users-client"

export async function AdminUsersPageContainer({
  page,
  currentUserId,
}: {
  page?: string
  currentUserId: string
}) {
  const data = await getAdminUsers(page)
  return <AdminUsersClient currentUserId={currentUserId} users={data.users} />
}
