import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const { outputText } = ts.transpileModule(
  readFileSync(new URL("../src/modules/public/lib/shop-offers.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
)
const { shopOfferDiscount } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
const now = Date.parse("2026-10-23T10:00:00Z")
const offer = {
  id: "coupon", code: "SHOP-GENERATED", name: "Ưu đãi shop", discount_type: "percent", discount_value: 20,
  minimum_order_amount: 100000, maximum_discount_amount: null, remaining_uses: null,
  starts_at: null, ends_at: null, products: [],
}

test("shop percentage discounts the remainder after wallet credits and rounds down", () => {
  assert.equal(shopOfferDiscount(offer, 200000, 150000, now), 30000)
  assert.equal(shopOfferDiscount(offer, 100000, 1001, now), 200)
})

test("shop discounts obey both the coupon cap and the remaining money", () => {
  assert.equal(shopOfferDiscount({ ...offer, maximum_discount_amount: 12000 }, 200000, 150000, now), 12000)
  assert.equal(shopOfferDiscount({ ...offer, discount_type: "fixed", discount_value: 500000 }, 200000, 150000, now), 150000)
  assert.equal(shopOfferDiscount(offer, 200000, 0, now), 0)
})

test("minimum spend uses the original product subtotal", () => {
  assert.equal(shopOfferDiscount(offer, 99999, 99999, now), 0)
  assert.equal(shopOfferDiscount(offer, 100000, 50000, now), 10000)
})

test("offers start inclusively, expire exclusively, and cannot exceed usage quota", () => {
  assert.equal(shopOfferDiscount({ ...offer, starts_at: new Date(now).toISOString() }, 100000, 100000, now), 20000)
  assert.equal(shopOfferDiscount({ ...offer, starts_at: new Date(now + 1).toISOString() }, 100000, 100000, now), 0)
  assert.equal(shopOfferDiscount({ ...offer, ends_at: new Date(now).toISOString() }, 100000, 100000, now), 0)
  assert.equal(shopOfferDiscount({ ...offer, remaining_uses: 0 }, 100000, 100000, now), 0)
  assert.equal(shopOfferDiscount(undefined, 100000, 100000, now), 0)
})
