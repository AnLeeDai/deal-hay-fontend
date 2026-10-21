import type { Metadata } from "next"

import { requireAdmin } from "@/lib/auth"
import { AdminTicketsPageContainer } from "@/modules/admin/containers/admin-tickets-page-container"

export const metadata: Metadata = { title: "Admin ticket" }

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string
    status?: string
    source?: string
    page?: string
  }>
}) {
  await requireAdmin()
  const { type, status, source, page } = await searchParams
  return (
    <AdminTicketsPageContainer
      type={type}
      status={status}
      source={source}
      page={page}
    />
  )
}
