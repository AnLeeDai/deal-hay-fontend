import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL(
      "../src/modules/discount-codes/lib/discount-codes.ts",
      import.meta.url
    ),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
)
const { discountCodeUnitPrice, summarizeDiscountCodes } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
)

function reward(id, amount, overrides = {}) {
  return {
    id,
    code: `DH-${id}`,
    reward_type: "fixed",
    reward_value: amount,
    fixed_amount: amount,
    original_price: 100000,
    sale_price: 80000,
    is_available: true,
    ...overrides,
  }
}

test("rewards earned from several ads can cover the full order at zero đồng", () => {
  const codes = [reward("one", 30000), reward("two", 70000)]
  assert.deepEqual(summarizeDiscountCodes(50000, 2, codes), {
    subtotal: 100000,
    discount: 100000,
    total: 0,
    appliedCodes: codes,
  })
})

test("discounts stop at the order subtotal and spare codes remain available", () => {
  const codes = [
    reward("one", 70000),
    reward("two", 70000),
    reward("spare", 10000),
  ]
  const summary = summarizeDiscountCodes(100000, 1, codes)
  assert.equal(summary.discount, 100000)
  assert.equal(summary.total, 0)
  assert.deepEqual(summary.appliedCodes, codes.slice(0, 2))
  assert.equal(codes[2].is_available, true)
  assert.equal(codes.length, 3)
})

test("fixed rewards discount the order once rather than every unit", () => {
  const summary = summarizeDiscountCodes(100000, 3, [reward("one", 10000)])
  assert.equal(summary.discount, 10000)
  assert.equal(summary.total, 290000)
})

test("each percentage uses the original subtotal and rounds half up", () => {
  const codes = [
    reward("one", 5000, { reward_type: "percentage", fixed_amount: null }),
    reward("two", 5000, { reward_type: "percentage", fixed_amount: null }),
  ]
  const summary = summarizeDiscountCodes(1001, 1, codes)
  assert.equal(summary.discount, 1001)
  assert.equal(summary.total, 0)
  assert.deepEqual(summary.appliedCodes, codes)
  assert.equal(summarizeDiscountCodes(1001, 1, [codes[0]]).discount, 501)
  assert.equal(summarizeDiscountCodes(1001, 3, [codes[0]]).discount, 1502)
})

test("percentage multiplication retains integer precision for large subtotals", () => {
  const summary = summarizeDiscountCodes(999999999, 9999, [
    reward("one", 3333, { reward_type: "percentage", fixed_amount: null }),
  ])
  assert.equal(summary.subtotal, 9998999990001)
  assert.equal(summary.discount, 3332666696667)
  assert.equal(summary.total, 6666333293334)
})

test("legacy ratios retain exact unit rounding before multiplying the quantity", () => {
  for (const reward_type of [undefined, "legacy_ratio"]) {
    const code = reward("legacy", 0, {
      reward_type,
      fixed_amount: null,
      original_price: 2,
      sale_price: 1,
    })
    const summary = summarizeDiscountCodes(1001, 3, [code])
    assert.equal(summary.total, discountCodeUnitPrice(1001, code) * 3)
    assert.equal(summary.total, 1503)
    assert.equal(summary.discount, 1500)
    assert.deepEqual(summary.appliedCodes, [code])
  }
})

test("unavailable, duplicate, and zero-value codes do not consume extra rewards", () => {
  const code = reward("one", 10000)
  const summary = summarizeDiscountCodes(100000, 1, [
    reward("used", 100000, { is_available: false }),
    reward("zero", 0),
    reward("rounds-to-zero", 1, {
      reward_type: "percentage",
      fixed_amount: null,
    }),
    code,
    code,
  ])
  assert.equal(summary.discount, 10010)
  assert.deepEqual(
    summary.appliedCodes.map((item) => item.id),
    ["rounds-to-zero", "one"]
  )
  const tiny = summarizeDiscountCodes(1, 1, [
    reward("rounds-to-zero", 1, {
      reward_type: "percentage",
      fixed_amount: null,
    }),
  ])
  assert.equal(tiny.discount, 0)
  assert.deepEqual(tiny.appliedCodes, [])
})

test("free items consume no rewards and invalid checkout amounts cannot grant discounts", () => {
  const codes = [reward("one", 10000)]
  assert.deepEqual(summarizeDiscountCodes(0, 1, codes), {
    subtotal: 0,
    discount: 0,
    total: 0,
    appliedCodes: [],
  })
  assert.deepEqual(summarizeDiscountCodes(100000, Number.NaN, codes), {
    subtotal: 0,
    discount: 0,
    total: 0,
    appliedCodes: [],
  })
})
