import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpileModule(path, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  return moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (_match, quote, specifier) => {
      assert.ok(imports[specifier], `Unmocked import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}

const apiUrl = moduleUrl(`
  export class ApiError extends Error { constructor(status, payload) { super(payload.message); this.status = status; this.errors = payload.errors } }
  export const state = { response: undefined, error: undefined, calls: [], revalidated: [] }
  export async function apiFetch(options) { state.calls.push(options); if (state.error) throw state.error; return state.response }
  export function revalidatePath(path) { state.revalidated.push(path) }
  export const deleteReview = () => {}; export const followShop = () => {}; export const reactToShop = () => {};
  export const startChat = () => {}; export const unfollowShop = () => {}; export const upsertReview = () => {};
`)
const validationUrl = transpileModule("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const reviewUrl = transpileModule("../src/modules/public/schemas/reviews.ts", {
  zod: import.meta.resolve("zod"),
  "@/lib/validation": validationUrl,
})
const checkoutUrl = transpileModule(
  "../src/modules/public/schemas/checkout.ts",
  { zod: import.meta.resolve("zod") }
)
const queriesUrl = transpileModule("../src/api/discount-codes/queries.ts", {
  "@/api/client": apiUrl,
})
const actions = await import(
  transpileModule("../src/modules/public/actions.ts", {
    "next/cache": apiUrl,
    "@/api/client": apiUrl,
    "@/api/catalog/mutations": apiUrl,
    "@/modules/public/schemas/reviews": reviewUrl,
    "@/modules/public/schemas/checkout": checkoutUrl,
  })
)
const wallet = await import(
  transpileModule("../src/modules/discount-codes/actions.ts", {
    "next/cache": apiUrl,
    "@/api/client": apiUrl,
    "@/api/discount-codes/queries": queriesUrl,
  })
)
const { state, ApiError } = await import(apiUrl)
const {
  discountCodeUnitPrice,
  discountCodeCanBeSaved,
  discountCodeProductHref,
} = await import(
  transpileModule("../src/modules/discount-codes/lib/discount-codes.ts")
)
const reward = { id: "reward-id", code: "DH-REALCODE", is_available: true }

test.beforeEach(() => {
  state.response = undefined
  state.error = undefined
  state.calls.length = 0
  state.revalidated.length = 0
})

test("verified ad completion returns the server-issued code and refreshes the wallet", async () => {
  state.response = { message: "Đã nhận mã.", discount_code: reward }
  const result = await actions.completeProductAdvertisementAction(
    "SHOP-1",
    "ao-thun",
    "view-id"
  )
  assert.deepEqual(result.data, reward)
  assert.equal(state.calls[0].method, "POST")
  assert.ok(state.calls[0].path.endsWith("/advertisement/view-id/complete"))
  assert.deepEqual(state.revalidated, ["/discount-codes"])
})

test("an unavailable automatic ad returns the server error without fabricating a session", async () => {
  state.error = new ApiError(422, {
    message: "Quảng cáo nhận thưởng hiện chưa khả dụng. Vui lòng thử lại sau.",
  })
  const result = await actions.startProductAdvertisementAction(
    "SHOP-1",
    "ao-thun"
  )
  assert.equal(result.success, false)
  assert.equal(result.data, undefined)
  assert.match(result.message, /chưa khả dụng/)
  assert.equal(state.calls.length, 1)
})

test("automatic ad sessions use the system provider presentation without seller videos", async () => {
  state.response = {
    id: "verified-provider-session",
    provider: "registered-provider",
    ad_type: "rewarded_video",
    presentation: { session_token: "public-launch-token" },
  }
  const result = await actions.startProductAdvertisementAction(
    "SHOP-1",
    "ao-thun"
  )
  assert.equal(result.success, true)
  assert.deepEqual(result.data, state.response)
  assert.equal(state.calls[0].body, undefined)
})

test("a rejected completion never returns or fabricates a coupon", async () => {
  state.error = new ApiError(422, { message: "Chưa xem hết quảng cáo." })
  const result = await actions.completeProductAdvertisementAction(
    "SHOP-1",
    "ao-thun",
    "view-id"
  )
  assert.equal(result.success, false)
  assert.equal(result.data, undefined)
  assert.equal(result.message, "Chưa xem hết quảng cáo.")
  assert.deepEqual(state.revalidated, [])
})

test("saving a code persists through the account API and wallet loading uses the product filter", async () => {
  state.response = { message: "Đã lưu.", discount_code: reward }
  assert.deepEqual(
    (await wallet.saveDiscountCodeAction("reward-id")).data,
    reward
  )
  assert.equal(state.calls[0].path, "/discount-codes/reward-id/save")
  assert.equal(state.calls[0].method, "POST")
  state.response = { discount_codes: [reward] }
  assert.deepEqual((await wallet.loadDiscountCodesAction("product-id")).data, [
    reward,
  ])
  assert.deepEqual(state.calls[1].searchParams, { product_id: "product-id" })
})

test("checkout passes the selected server code and idempotency key without client-controlled prices", async () => {
  state.response = {
    message: "Đặt hàng thành công.",
    order: { order_number: "DH-1", total: 80000 },
  }
  const values = {
    customer_name: "Nguyễn A",
    customer_phone: "0901234567",
    shipping_address: "12 Phố Huế",
    shipping_province_code: "1",
    shipping_ward_code: "70",
    quantity: 1,
    note: "",
    discount_code: reward.code,
    total: 1,
    discount_amount: 99999,
  }
  const result = await actions.orderProductAction(
    "SHOP-1",
    "ao-thun",
    values,
    "request-id"
  )
  assert.equal(result.success, true)
  assert.equal(state.calls[0].headers["Idempotency-Key"], "request-id")
  assert.equal(state.calls[0].body.discount_code, reward.code)
  assert.equal(state.calls[0].body.total, undefined)
  assert.equal(state.calls[0].body.discount_amount, undefined)
  assert.ok(state.revalidated.includes("/discount-codes"))
})

test("checkout forwards accumulated codes and preserves a server-confirmed zero total", async () => {
  const codes = ["DH-FIRST", "DH-SECOND", "DH-UNUSED"]
  state.response = {
    message: "Đặt hàng thành công.",
    order: {
      order_number: "DH-FREE",
      total: 0,
      redeemed_discount_codes: codes.slice(0, 2),
    },
  }
  const result = await actions.orderProductAction(
    "SHOP-1",
    "ao-thun",
    {
      customer_name: "Nguyễn A",
      customer_phone: "0901234567",
      shipping_address: "12 Phố Huế",
      shipping_province_code: "1",
      shipping_ward_code: "70",
      quantity: 1,
      note: "",
      discount_codes: codes,
    },
    "free-order-request"
  )
  assert.equal(result.success, true)
  assert.equal(result.data.total, 0)
  assert.deepEqual(result.data.redeemed_discount_codes, codes.slice(0, 2))
  assert.deepEqual(state.calls[0].body.discount_codes, codes)
  assert.equal(state.calls[0].body.total, undefined)
})

test("saved discount snapshots calculate the same ratio on current variant prices", () => {
  const code = {
    original_price: 100000,
    sale_price: 80000,
    discount_percent: 99,
  }
  assert.equal(discountCodeUnitPrice(100000, code), 80000)
  assert.equal(discountCodeUnitPrice(150000, code), 120000)
})

test("coupon prices use exact half-up rounding without float loss at large amounts", () => {
  assert.equal(
    discountCodeUnitPrice(1001, { original_price: 2, sale_price: 1 }),
    501
  )
  assert.equal(
    discountCodeUnitPrice(4294967295, {
      original_price: 999999999,
      sale_price: 999999998,
    }),
    4294967291
  )
  assert.equal(
    discountCodeUnitPrice(100000, { original_price: 0, sale_price: 1 }),
    100000
  )
})

test("unsaved valid codes can be saved, while used or expired codes cannot", () => {
  const code = {
    saved_at: null,
    used_at: null,
    expires_at: "2026-11-15T00:00:00Z",
  }
  const now = Date.parse("2026-10-16T00:00:00Z")
  assert.equal(discountCodeCanBeSaved(code, now), true)
  assert.equal(
    discountCodeCanBeSaved({ ...code, used_at: "2026-10-15T00:00:00Z" }, now),
    false
  )
  assert.equal(
    discountCodeCanBeSaved(code, Date.parse("2026-11-16T00:00:00Z")),
    false
  )
})

test("wallet use links retain the actual coupon and encode product route segments", () => {
  assert.equal(
    discountCodeProductHref({
      code: "DH-A&B",
      product: { slug: "ao/thun", shop: { code: "SHOP 1" } },
    }),
    "/shops/SHOP%201/products/ao%2Fthun?discount_code=DH-A%26B"
  )
})
