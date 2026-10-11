import { getAdminTickets } from "@/api/admin/queries"
import { AdminTicketsClient } from "@/modules/admin/components/admin-tickets-client"

export async function AdminTicketsPageContainer({
  type,
  status,
  source,
  page,
}: {
  type?: string
  status?: string
  source?: string
  page?: string
}) {
  const data = await getAdminTickets(type, status, source, page)
  return <AdminTicketsClient tickets={data.tickets} />
}
