export type ProductOptionDraft = { name: string; values: string }
export type ProductOption = { name: string; values: string[] }
export type ProductVariantDraft = {
  option_values: Record<string, string>
  price: number | ""
  stock: number
  is_active: boolean
  is_default: boolean
}
export type CatalogIssue = {
  path: Array<string | number>
  message: string
}

export function normalizeCatalogText(value: string): string {
  return value.replace(/\s+/gu, " ").trim()
}

// Match the catalog's Vietnamese, case-insensitive keys on the API.
export function catalogKey(value: string): string {
  return normalizeCatalogText(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/gu, "d")
    .toLocaleLowerCase("vi")
}

function combinationKey(values: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(values)
      .map(([name, value]) => [catalogKey(name), catalogKey(value)])
      .sort(([left], [right]) => left.localeCompare(right))
  )
}

export function validateProductOptions(
  options: ProductOptionDraft[]
):
  | { success: true; options: ProductOption[]; combinationCount: number }
  | { success: false; issues: CatalogIssue[] } {
  const issues: CatalogIssue[] = []
  const names = new Set<string>()
  let combinationCount = 1

  if (options.length === 0) {
    issues.push({
      path: ["options"],
      message: "Vui lòng thêm ít nhất một thuộc tính sản phẩm.",
    })
  } else if (options.length > 3) {
    issues.push({
      path: ["options"],
      message: "Mỗi sản phẩm có tối đa 3 thuộc tính.",
    })
  }

  const normalizedOptions = options.map((option, index) => {
    const name = normalizeCatalogText(option.name)
    const nameKey = catalogKey(name)
    const values = option.values
      .split(",")
      .map(normalizeCatalogText)
      .filter(Boolean)
    const valueKeys = values.map(catalogKey)

    if (!name) {
      issues.push({
        path: ["options", index, "name"],
        message: "Vui lòng nhập tên thuộc tính.",
      })
    } else if (name.length > 80) {
      issues.push({
        path: ["options", index, "name"],
        message: "Tên thuộc tính không được vượt quá 80 ký tự.",
      })
    } else if (names.has(nameKey)) {
      issues.push({
        path: ["options", index, "name"],
        message: "Tên thuộc tính không được trùng nhau.",
      })
    }
    names.add(nameKey)

    if (values.length === 0) {
      issues.push({
        path: ["options", index, "values"],
        message: "Nhập ít nhất một giá trị, ngăn cách bằng dấu phẩy.",
      })
    } else if (values.length > 50) {
      issues.push({
        path: ["options", index, "values"],
        message: "Mỗi thuộc tính có tối đa 50 giá trị.",
      })
    }

    if (values.some((value) => value.length > 80)) {
      issues.push({
        path: ["options", index, "values"],
        message: "Mỗi giá trị thuộc tính không được vượt quá 80 ký tự.",
      })
    }
    if (new Set(valueKeys).size !== valueKeys.length) {
      issues.push({
        path: ["options", index, "values"],
        message: "Giá trị thuộc tính không được trùng nhau.",
      })
    }

    // Count first so oversized input never allocates a Cartesian product.
    combinationCount *= values.length
    return { name, values }
  })

  if (combinationCount > 100) {
    issues.push({
      path: ["variants"],
      message: "Các thuộc tính tạo ra hơn 100 biến thể. Hãy giảm bớt giá trị.",
    })
  }

  return issues.length > 0
    ? { success: false, issues }
    : { success: true, options: normalizedOptions, combinationCount }
}

export function buildProductVariants(
  options: ProductOptionDraft[],
  existingVariants: ProductVariantDraft[]
):
  | { success: false; issues: CatalogIssue[] }
  | {
      success: true
      options: ProductOption[]
      variants: ProductVariantDraft[]
    } {
  const catalog = validateProductOptions(options)
  if (!catalog.success) return catalog

  const existing = new Map(
    existingVariants.map((variant) => [
      combinationKey(variant.option_values),
      variant,
    ])
  )
  const combinations = catalog.options.reduce<Record<string, string>[]>(
    (current, option) =>
      current.flatMap((combination) =>
        option.values.map((value) => ({ ...combination, [option.name]: value }))
      ),
    [{}]
  )
  const variants = combinations.map((optionValues) => {
    const previous = existing.get(combinationKey(optionValues))
    return {
      option_values: optionValues,
      price: previous?.price ?? "",
      stock: previous?.stock ?? 0,
      is_active: previous?.is_active ?? true,
      is_default: previous?.is_default ?? false,
    }
  })

  let defaultIndex = variants.findIndex(
    (variant) => variant.is_default && variant.is_active
  )
  if (defaultIndex < 0) {
    defaultIndex = variants.findIndex((variant) => variant.is_active)
  }
  if (defaultIndex < 0) defaultIndex = 0

  variants.forEach((variant, index) => {
    variant.is_default = index === defaultIndex
    if (variant.is_default) variant.is_active = true
  })

  return { success: true, options: catalog.options, variants }
}

export function variantsMatchOptions(
  options: ProductOption[],
  combinationCount: number,
  variants: ProductVariantDraft[]
): boolean {
  if (variants.length !== combinationCount) return false

  const combinations = new Set<string>()
  for (const variant of variants) {
    const entries = Object.entries(variant.option_values)
    if (entries.length !== options.length) return false
    const values = new Map(
      entries.map(([name, value]) => [catalogKey(name), catalogKey(value)])
    )
    if (values.size !== options.length) return false
    if (
      options.some(
        (option) =>
          !option.values.some(
            (value) => catalogKey(value) === values.get(catalogKey(option.name))
          )
      )
    ) {
      return false
    }

    const key = combinationKey(variant.option_values)
    if (combinations.has(key)) return false
    combinations.add(key)
  }
  return true
}

export function canonicalVariantValues(
  options: ProductOption[],
  values: Record<string, string>
): Record<string, string> {
  const provided = new Map(
    Object.entries(values).map(([name, value]) => [
      catalogKey(name),
      catalogKey(value),
    ])
  )
  return Object.fromEntries(
    options.map((option) => [
      option.name,
      option.values.find(
        (value) => catalogKey(value) === provided.get(catalogKey(option.name))
      ) ?? "",
    ])
  )
}

export function productFormErrors(
  errors: Record<string, string[]> | undefined
): Record<string, string[]> | undefined {
  if (!errors) return undefined
  const result: Record<string, string[]> = {}
  for (const [path, messages] of Object.entries(errors)) {
    // API values are an array; the form edits them in one comma-separated input.
    const field = path.replace(/^(options\.\d+\.values)\.\d+$/, "$1")
    result[field] = [...(result[field] ?? []), ...messages]
  }
  return result
}
