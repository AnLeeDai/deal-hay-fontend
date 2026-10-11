import { apiFetch } from "@/api/client"
import { adminRoutes } from "@/api/admin/routes"
import type {
  AdminCategoriesResponse,
  AdminShopsResponse,
  AdminTicketsResponse,
  AdminUsersResponse,
} from "@/types/admin"

export function getAdminUsers(page?: string): Promise<AdminUsersResponse> {
  return apiFetch({ path: adminRoutes.users, searchParams: { page } })
}

export function getAdminShops(
  search?: string,
  status?: string,
  page?: string
): Promise<AdminShopsResponse> {
  return apiFetch({
    path: adminRoutes.shops,
    searchParams: { search, status, page },
  })
}

export function getAdminCategories(): Promise<AdminCategoriesResponse> {
  return apiFetch({ path: adminRoutes.categories })
}

export function getAdminTickets(
  type?: string,
  status?: string,
  source?: string,
  page?: string
): Promise<AdminTicketsResponse> {
  return apiFetch({
    path: adminRoutes.tickets,
    searchParams: { type, status, source, page },
  })
}
