import type { Metadata } from "next"

import { ProductPageContainer } from "@/modules/public/containers/product-page-container"

export const metadata: Metadata = { title: "Chi tiết sản phẩm" }

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopUserCode: string; productSlug: string }>
  searchParams: Promise<{ discount_code?: string | string[] }>
}) {
  const [{ shopUserCode, productSlug }, query] = await Promise.all([
    params,
    searchParams,
  ])
  return (
    <ProductPageContainer
      shopUserCode={shopUserCode}
      productSlug={productSlug}
      initialDiscountCode={
        typeof query.discount_code === "string" &&
        query.discount_code.length <= 80
          ? query.discount_code
          : undefined
      }
    />
  )
}
