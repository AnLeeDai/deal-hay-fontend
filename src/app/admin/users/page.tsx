import type { Metadata } from "next"

import { requireAdmin } from "@/lib/auth"
import { AdminUsersPageContainer } from "@/modules/admin/containers/admin-users-page-container"

export const metadata: Metadata = { title: "Admin người dùng" }

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireAdmin()
  const { page } = await searchParams
  return <AdminUsersPageContainer page={page} />
}
