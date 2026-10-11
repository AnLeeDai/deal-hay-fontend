import type { Metadata } from "next"

import { requireAdmin } from "@/lib/auth"
import { AdminCategoriesPageContainer } from "@/modules/admin/containers/admin-categories-page-container"

export const metadata: Metadata = { title: "Admin danh mục" }

export default async function AdminCategoriesPage() {
  await requireAdmin()
  return <AdminCategoriesPageContainer />
}
