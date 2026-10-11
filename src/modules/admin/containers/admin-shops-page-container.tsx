import { getAdminShops } from "@/api/admin/queries"
import { AdminShopsClient } from "@/modules/admin/components/admin-shops-client"

export async function AdminShopsPageContainer({
  search,
  status,
  page,
}: {
  search?: string
  status?: string
  page?: string
}) {
  const data = await getAdminShops(search, status, page)
  return <AdminShopsClient shops={data.shops} />
}
