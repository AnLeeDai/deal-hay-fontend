import type { Metadata } from "next"

import { requireAdmin } from "@/lib/auth"
import { AdminShopsPageContainer } from "@/modules/admin/containers/admin-shops-page-container"

export const metadata: Metadata = { title: "Admin shop" }

export default async function AdminShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>
}) {
  await requireAdmin()
  const { search, status, page } = await searchParams
  return <AdminShopsPageContainer search={search} status={status} page={page} />
}
