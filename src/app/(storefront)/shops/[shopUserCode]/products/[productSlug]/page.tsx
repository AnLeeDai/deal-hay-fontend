import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ProductPageContainer } from "@/modules/public/containers/product-page-container"
import { productCheckoutHref } from "@/modules/public/lib/product-checkout"

export const metadata: Metadata = { title: "Chi tiết sản phẩm" }

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopUserCode: string; productSlug: string }>
  searchParams: Promise<{
    discount_code?: string | string[]
    variant_id?: string | string[]
  }>
}) {
  const [{ shopUserCode, productSlug }, query] = await Promise.all([
    params,
    searchParams,
  ])
  const initialDiscountCode =
    typeof query.discount_code === "string" && query.discount_code.length <= 80
      ? query.discount_code
      : undefined

  if (initialDiscountCode) {
    redirect(
      productCheckoutHref(shopUserCode, productSlug, {
        variantId: query.variant_id,
        discountCode: initialDiscountCode,
      })
    )
  }

  return (
    <ProductPageContainer
      shopUserCode={shopUserCode}
      productSlug={productSlug}
      initialVariantId={
        typeof query.variant_id === "string" ? query.variant_id : undefined
      }
    />
  )
}
