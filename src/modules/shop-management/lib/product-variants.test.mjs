import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import test from "node:test"

import {
  buildProductVariants,
  canonicalVariantValues,
  productFormErrors,
  validateProductOptions,
  variantsMatchOptions,
} from "./product-variants.ts"

// Resolve the app's existing alias while loading its real validation schema.
const aliases = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(
        new URL(`../../../${specifier.slice(2)}.ts`, import.meta.url).href,
        context
      )
    }
    return nextResolve(specifier, context)
  },
})
const { createProductSchema } = await import("../schemas/shop-management.ts")
aliases.deregister()

const variant = (values, overrides = {}) => ({
  option_values: values,
  price: "",
  stock: 0,
  is_active: true,
  is_default: false,
  ...overrides,
})
const options = [{ name: "Màu sắc", values: "Đỏ, Trắng" }]
const build = (draftOptions = options, previous = []) => {
  const result = buildProductVariants(draftOptions, previous)
  assert.equal(result.success, true)
  return result
}
const product = (overrides = {}) => ({
  name: "Áo thun",
  category: "Thời trang",
  price: 10000,
  stock: 4,
  label: "",
  description: "",
  image: new File(["image"], "product.png", { type: "image/png" }),
  gallery_images: [],
  has_variants: true,
  options,
  variants: build().variants,
  ...overrides,
})

test("adding a new first combination preserves exactly one existing default", () => {
  const result = build(
    [{ name: "Màu sắc", values: "Xanh, Đỏ" }],
    [variant({ "Màu sắc": "Đỏ" }, { price: 25000, stock: 7, is_default: true })]
  )
  assert.deepEqual(
    result.variants.map((item) => item.is_default),
    [false, true]
  )
  assert.equal(result.variants[1].price, 25000)
  assert.equal(result.variants[1].stock, 7)
  assert.equal(result.variants[0].stock, 0)
})

test("case, accents, spacing and attribute order preserve existing values", () => {
  const result = build(
    [
      { name: " Kích   thước ", values: " L " },
      { name: " màu   sắc ", values: " Đỏ   đậm " },
    ],
    [
      variant(
        { "Mau sac": "DO DAM", "Kich thuoc": "l" },
        {
          price: 35000,
          stock: 12,
          is_default: true,
        }
      ),
    ]
  )
  assert.deepEqual(result.options, [
    { name: "Kích thước", values: ["L"] },
    { name: "màu sắc", values: ["Đỏ đậm"] },
  ])
  assert.equal(result.variants[0].stock, 12)
  assert.equal(result.variants[0].price, 35000)
  assert.equal(result.variants[0].is_default, true)
})

test("removing the default selects an active remaining combination", () => {
  const result = build(options, [
    variant({ "Màu sắc": "Xanh" }, { is_default: true }),
    variant({ "Màu sắc": "Đỏ" }, { stock: 6, is_active: false }),
    variant({ "Màu sắc": "Trắng" }, { stock: 8 }),
  ])
  assert.equal(result.variants[0].is_active, false)
  assert.equal(result.variants[0].is_default, false)
  assert.equal(result.variants[1].is_default, true)
  assert.equal(result.variants[1].stock, 8)
})

test("regeneration repairs duplicate or inactive defaults", () => {
  const duplicated = build(options, [
    variant({ "Màu sắc": "Đỏ" }, { is_default: true }),
    variant({ "Màu sắc": "Trắng" }, { is_default: true }),
  ])
  assert.equal(duplicated.variants.filter((item) => item.is_default).length, 1)
  const inactive = build(options, [
    variant({ "Màu sắc": "Đỏ" }, { is_default: true, is_active: false }),
    variant({ "Màu sắc": "Trắng" }, { is_active: false }),
  ])
  assert.equal(inactive.variants[0].is_default, true)
  assert.equal(inactive.variants[0].is_active, true)
})

test("attribute validation matches API uniqueness and value limits", () => {
  const invalidOptions = [
    [],
    [
      { name: "Màu  sắc", values: "Đỏ" },
      { name: " mau sac ", values: "Trắng" },
    ],
    [{ name: "Màu sắc", values: "Đỏ   đậm, do dam" }],
    [{ name: "Màu sắc", values: ", ," }],
    [{ name: "a".repeat(81), values: "Đỏ" }],
    [{ name: "Màu sắc", values: "a".repeat(81) }],
    [
      {
        name: "Màu sắc",
        values: Array.from({ length: 51 }, (_, i) => `Màu ${i}`).join(","),
      },
    ],
  ]
  for (const input of invalidOptions) {
    assert.equal(validateProductOptions(input).success, false)
  }
})

test("combination limits are checked before building the Cartesian product", () => {
  const fiftyValues = Array.from({ length: 50 }, (_, i) => `Giá trị ${i}`).join(
    ","
  )
  const maximum = build([
    { name: "Màu sắc", values: fiftyValues },
    { name: "Kích thước", values: "M, L" },
  ])
  assert.equal(maximum.variants.length, 100)
  const tooMany = buildProductVariants(
    [
      { name: "Màu sắc", values: fiftyValues },
      { name: "Kích thước", values: fiftyValues },
      { name: "Phiên bản", values: fiftyValues },
    ],
    []
  )
  assert.equal(tooMany.success, false)
  assert.equal("variants" in tooMany, false)
  assert.ok(tooMany.issues.some((issue) => issue.path[0] === "variants"))
})

test("changed attributes require regeneration, equivalent formatting does not", () => {
  const built = build()
  const matches = (draft, variants = built.variants) => {
    const parsed = validateProductOptions(draft)
    assert.equal(parsed.success, true)
    return variantsMatchOptions(
      parsed.options,
      parsed.combinationCount,
      variants
    )
  }
  assert.equal(matches([{ name: " mau   sac ", values: "TRANG, do" }]), true)
  assert.equal(matches([{ name: "Màu sắc", values: "Đỏ, Trắng, Xanh" }]), false)
  assert.equal(matches([{ name: "Màu sắc", values: "Đỏ" }]), false)
  assert.equal(matches([{ name: "Kích thước", values: "M, L" }]), false)
  assert.equal(matches(options, [built.variants[0], built.variants[0]]), false)
})

test("payload values use the canonical attribute and value spelling", () => {
  assert.deepEqual(
    canonicalVariantValues([{ name: "Màu sắc", values: ["Đỏ đậm", "Trắng"] }], {
      " mau sac ": "DO   DAM",
    }),
    { "Màu sắc": "Đỏ đậm" }
  )
})

test("API value-array errors appear on the visible comma-separated input", () => {
  assert.deepEqual(
    productFormErrors({
      "options.0.values.1": ["Trùng giá trị"],
      "options.0.values.2": ["Giá trị quá dài"],
      "variants.0.option_values": ["Sai thuộc tính"],
    }),
    {
      "options.0.values": ["Trùng giá trị", "Giá trị quá dài"],
      "variants.0.option_values": ["Sai thuộc tính"],
    }
  )
})

test("switching off variants ignores hidden invalid options and variant fields", () => {
  const result = createProductSchema.safeParse(
    product({
      has_variants: false,
      options: [{ name: "", values: "" }],
      variants: [variant({}, { price: Number.NaN, stock: Number.NaN })],
    })
  )
  assert.equal(result.success, true)
  assert.equal(result.data.stock, 4)
  assert.deepEqual(result.data.options, [])
  assert.deepEqual(result.data.variants, [])
})

test("variant mode ignores hidden simple stock and validates visible stock", () => {
  const valid = createProductSchema.safeParse(product({ stock: Number.NaN }))
  assert.equal(valid.success, true)
  assert.equal(valid.data.stock, 0)
  const broken = product({ stock: Number.NaN })
  broken.variants[0].stock = Number.NaN
  const invalid = createProductSchema.safeParse(broken)
  assert.equal(invalid.success, false)
  assert.ok(
    invalid.error.issues.some(
      (issue) => issue.path.join(".") === "variants.0.stock"
    )
  )
})

test("schema rejects stale catalogs and an inactive default", () => {
  const stale = createProductSchema.safeParse(
    product({
      options: [{ name: "Màu sắc", values: "Đỏ, Trắng, Xanh" }],
    })
  )
  assert.equal(stale.success, false)
  assert.ok(
    stale.error.issues.some((issue) => issue.path.join(".") === "variants")
  )
  const broken = product()
  broken.variants[0].is_active = false
  const inactive = createProductSchema.safeParse(broken)
  assert.equal(inactive.success, false)
  assert.ok(
    inactive.error.issues.some(
      (issue) => issue.path.join(".") === "variants.0.is_active"
    )
  )
})

test("missing image returns validation errors without throwing", () => {
  assert.doesNotThrow(() => {
    const result = createProductSchema.safeParse(product({ image: undefined }))
    assert.equal(result.success, false)
    assert.ok(result.error.issues.some((issue) => issue.path[0] === "image"))
  })
})
