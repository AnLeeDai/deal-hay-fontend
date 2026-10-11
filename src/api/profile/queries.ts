import { apiFetch } from "@/api/client"
import { profileRoutes } from "@/api/profile/routes"
import type { ProfileResponse, ShopManageResponse } from "@/api/profile/types"

export function getProfile(): Promise<ProfileResponse> {
  return apiFetch({ path: profileRoutes.me })
}

export function getShopManage(): Promise<ShopManageResponse> {
  return apiFetch({ path: profileRoutes.shopManage })
}
