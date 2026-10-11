import { apiFetch } from "@/api/client"
import { catalogRoutes } from "@/api/catalog/routes"
import type {
  HomeResponse,
  ProductResponse,
  ShopResponse,
} from "@/api/catalog/types"

export function getHome(category?: string): Promise<HomeResponse> {
  return apiFetch({ path: catalogRoutes.home, searchParams: { category } })
}

export function getShop(
  shopUserCode: string,
  category?: string,
  page?: string
): Promise<ShopResponse> {
  return apiFetch({
    path: catalogRoutes.shop(shopUserCode),
    searchParams: { category, page },
  })
}

export function getProduct(
  shopUserCode: string,
  productSlug: string
): Promise<ProductResponse> {
  return apiFetch({ path: catalogRoutes.product(shopUserCode, productSlug) })
}
