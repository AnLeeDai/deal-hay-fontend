import type { Metadata } from "next"

import { ProductPageContainer } from "@/modules/public/containers/product-page-container"

export const metadata: Metadata = { title: "Chi tiết sản phẩm" }

export default async function ProductPage({
  params,
}: {
  params: Promise<{ shopUserCode: string; productSlug: string }>
}) {
  const { shopUserCode, productSlug } = await params
  return (
    <ProductPageContainer
      shopUserCode={shopUserCode}
      productSlug={productSlug}
    />
  )
}
