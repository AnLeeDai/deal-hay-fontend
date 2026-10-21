import type { Metadata } from "next"

import { ShopPageContainer } from "@/modules/public/containers/shop-page-container"

export const metadata: Metadata = { title: "Shop công khai" }

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopUserCode: string }>
  searchParams: Promise<{ category?: string; page?: string }>
}) {
  const { shopUserCode } = await params
  const { category, page } = await searchParams
  return (
    <ShopPageContainer
      shopUserCode={shopUserCode}
      category={category}
      page={page}
    />
  )
}
