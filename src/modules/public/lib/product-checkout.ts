import { defaultProductVariant } from "@/modules/public/lib/variant-selection"
import type { PublicProduct, PublicProductVariant } from "@/types/catalog"

export function productCheckoutHref(
  shopUserCode: string,
  productSlug: string,
  options: { variantId?: string | string[]; discountCode?: string } = {}
): string {
  const query = new URLSearchParams()
  const variantIds = Array.isArray(options.variantId)
    ? options.variantId
    : options.variantId === undefined
      ? []
      : [options.variantId]

  for (const variantId of variantIds) query.append("variant_id", variantId)
  if (options.discountCode) query.set("discount_code", options.discountCode)

  const path = `/shops/${encodeURIComponent(shopUserCode)}/products/${encodeURIComponent(productSlug)}/checkout`
  return query.size > 0 ? `${path}?${query}` : path
}

export function resolveCheckoutVariant(
  product: Pick<PublicProduct, "has_variants" | "variants">,
  variantId?: string | string[]
): { variant?: PublicProductVariant; invalidVariant: boolean } {
  if (variantId !== undefined) {
    const variant =
      typeof variantId === "string"
        ? product.variants.find(
            (candidate) => candidate.id === variantId && candidate.is_active
          )
        : undefined

    return { variant, invalidVariant: !variant }
  }

  return {
    variant:
      product.has_variants || product.variants.length > 0
        ? defaultProductVariant(product.variants)
        : undefined,
    invalidVariant: false,
  }
}
