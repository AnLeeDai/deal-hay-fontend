import { getAdminUsers } from "@/api/admin/queries"
import { AdminUsersClient } from "@/modules/admin/components/admin-users-client"

export async function AdminUsersPageContainer({ page }: { page?: string }) {
  const data = await getAdminUsers(page)
  return <AdminUsersClient users={data.users} />
}
