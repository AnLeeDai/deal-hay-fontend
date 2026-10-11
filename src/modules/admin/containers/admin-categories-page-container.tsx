import { getAdminCategories } from "@/api/admin/queries"
import { AdminCategoriesClient } from "@/modules/admin/components/admin-categories-client"

export async function AdminCategoriesPageContainer() {
  const data = await getAdminCategories()
  return <AdminCategoriesClient categories={data.categories} />
}
