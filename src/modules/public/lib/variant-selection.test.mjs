import assert from "node:assert/strict"
import test from "node:test"

import {
  defaultProductVariant,
  selectProductVariant,
  variantHasOption,
} from "./variant-selection.ts"

const variant = (id, color, size, extra = {}) => ({
  id,
  sku: id,
  option_values: { "Màu sắc": color, "Kích thước": size },
  price: null,
  stock: 5,
  is_active: true,
  is_default: false,
  ...extra,
})

test("starts with the available default and falls back when it is sold out or hidden", () => {
  const regular = variant("regular", "Đỏ", "S")
  const preferred = variant("preferred", "Xanh", "M", { is_default: true })
  assert.equal(defaultProductVariant([regular, preferred])?.id, "preferred")
  assert.equal(
    defaultProductVariant([regular, { ...preferred, stock: 0 }])?.id,
    "regular"
  )
  assert.equal(
    defaultProductVariant([regular, { ...preferred, is_active: false }])?.id,
    "regular"
  )
})

test("sold-out active variants remain selectable for consultation", () => {
  const soldOut = variant("sold-out", "Đỏ", "S", {
    is_default: true,
    stock: 0,
  })
  assert.equal(defaultProductVariant([soldOut])?.id, "sold-out")
  assert.equal(
    selectProductVariant([soldOut], undefined, "Màu sắc", "Đỏ")?.id,
    "sold-out"
  )
})

test("changing one option preserves compatible choices and its variant price and stock", () => {
  const redSmall = variant("red-s", "Đỏ", "S")
  const blueSmall = variant("blue-s", "Xanh", "S", { price: 25000, stock: 9 })
  const blueMedium = variant("blue-m", "Xanh", "M", { is_default: true })
  const selected = selectProductVariant(
    [redSmall, blueSmall, blueMedium],
    redSmall,
    "Màu sắc",
    "Xanh"
  )
  assert.equal(selected?.id, "blue-s")
  assert.equal(selected?.price, 25000)
  assert.equal(selected?.stock, 9)
})

test("sparse combinations can be reached without getting stuck on incompatible choices", () => {
  const redSmall = variant("red-s", "Đỏ", "S")
  const blueMedium = variant("blue-m", "Xanh", "M")
  const variants = [redSmall, blueMedium]
  assert.equal(
    selectProductVariant(variants, redSmall, "Màu sắc", "Xanh")?.id,
    "blue-m"
  )
  assert.equal(
    selectProductVariant(variants, blueMedium, "Kích thước", "S")?.id,
    "red-s"
  )
})

test("hidden or nonexistent combinations cannot be selected", () => {
  const hidden = variant("hidden", "Đỏ", "S", { is_active: false })
  assert.equal(defaultProductVariant([hidden]), undefined)
  assert.equal(
    selectProductVariant([hidden], undefined, "Màu sắc", "Đỏ"),
    undefined
  )
  assert.equal(
    selectProductVariant([], undefined, "Màu sắc", "Xanh"),
    undefined
  )
})

test("matches option names and values using the catalog's case and whitespace normalization", () => {
  const redSmall = variant("red-s", "Đỏ", "S")
  assert.equal(variantHasOption(redSmall, "  MAU   SAC ", " DO "), true)
  assert.equal(
    selectProductVariant([redSmall], undefined, "  màu   sắc ", "đỏ")?.id,
    "red-s"
  )
})
