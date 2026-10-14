import type { PublicProductVariant } from "@/types/catalog"

function optionKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

export function variantHasOption(
  variant: PublicProductVariant,
  name: string,
  value: string
): boolean {
  return Object.entries(variant.option_values).some(
    ([optionName, optionValue]) =>
      optionKey(optionName) === optionKey(name) &&
      optionKey(optionValue) === optionKey(value)
  )
}

export function defaultProductVariant(
  variants: PublicProductVariant[]
): PublicProductVariant | undefined {
  const active = variants.filter((variant) => variant.is_active)

  return (
    active.find((variant) => variant.is_default && variant.stock > 0) ??
    active.find((variant) => variant.stock > 0) ??
    active.find((variant) => variant.is_default) ??
    active[0]
  )
}

// Keep as many other choices as possible while always selecting a real variant.
// This also lets buyers switch between sparse combinations, e.g. Red/S and Blue/M.
export function selectProductVariant(
  variants: PublicProductVariant[],
  current: PublicProductVariant | undefined,
  name: string,
  value: string
): PublicProductVariant | undefined {
  const candidates = variants.filter(
    (variant) => variant.is_active && variantHasOption(variant, name, value)
  )
  const otherChoices = Object.entries(current?.option_values ?? {}).filter(
    ([optionName]) => optionKey(optionName) !== optionKey(name)
  )
  const score = (variant: PublicProductVariant) =>
    otherChoices.filter(([optionName, optionValue]) =>
      variantHasOption(variant, optionName, optionValue)
    ).length
  const bestScore = Math.max(-1, ...candidates.map(score))

  return defaultProductVariant(
    candidates.filter((variant) => score(variant) === bestScore)
  )
}
