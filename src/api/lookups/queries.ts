import { apiFetch } from "@/api/client"
import { lookupRoutes } from "@/api/lookups/routes"
import type { Province, Ward } from "@/api/lookups/types"

export function getProvinces(): Promise<Province[]> {
  return apiFetch({ path: lookupRoutes.provinces })
}

export function getWards(provinceCode: string): Promise<Ward[]> {
  return apiFetch({ path: lookupRoutes.wards(provinceCode) })
}
