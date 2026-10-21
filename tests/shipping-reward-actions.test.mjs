import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`

const apiUrl = moduleUrl(`
  export class ApiError extends Error {
    constructor(status, payload) {
      super(payload.message)
      this.status = status
      this.errors = payload.errors
    }
  }
  export const state = { calls: [], response: undefined, error: undefined }
  export async function apiFetch(options) {
    state.calls.push(options)
    if (state.error) throw state.error
    return state.response
  }
`)
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL(
      "../src/modules/public/shipping-reward-actions.ts",
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
const {
  loadShippingOfferAction,
  loadShippingDiscountCodeAction,
  startShippingRewardViewAction,
  redeemShippingRewardAction,
} = await import(
  moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (_match, quote, specifier) => {
      assert.equal(specifier, "@/api/client", `Unmocked import: ${specifier}`)
      return `from ${quote}${apiUrl}${quote}`
    })
  )
)
const { ApiError, state } = await import(apiUrl)
const productPath = "/shops/SHOP%20%2F1/products/%C3%A1o%2Fthun%3Fx%3D1"
const reward = {
  id: "server-code-id",
  code: "SHIP-SERVER-CODE",
  expires_at: "2026-10-23T09:00:00Z",
  used_at: null,
  is_available: true,
  product_id: "server-product-id",
  discount_percent: 100,
}
const actions = [
  loadShippingOfferAction,
  loadShippingDiscountCodeAction,
  startShippingRewardViewAction,
  (shopCode, productSlug) =>
    redeemShippingRewardAction(shopCode, productSlug, "view-id"),
]

test.beforeEach(() => {
  state.calls.length = 0
  state.response = undefined
  state.error = undefined
})

test("opening a shipping offer reads eligibility without creating a view or claiming a code", async () => {
  state.response = {
    shipping_offer: { available: true, unavailable_reason: null },
  }
  const result = await loadShippingOfferAction("SHOP /1", "áo/thun?x=1")
  assert.deepEqual(result, {
    success: true,
    message: "",
    data: state.response.shipping_offer,
  })
  assert.deepEqual(state.calls, [
    {
      method: "GET",
      path: `${productPath}/shipping-offer`,
      cache: "no-store",
    },
  ])
})

test("unavailable shipping offers preserve the server reason", async () => {
  for (const reason of ["promotion_disabled", "shipping_not_configured"]) {
    state.response = {
      shipping_offer: { available: false, unavailable_reason: reason },
    }
    const result = await loadShippingOfferAction("SHOP-1", "ao-thun")
    assert.equal(result.success, true)
    assert.equal(result.data.available, false)
    assert.equal(result.data.unavailable_reason, reason)
  }
  assert.ok(state.calls.every((call) => call.method === "GET"))
})

test("starting a shipping reward returns only the server view, then redemption returns the real code", async () => {
  const view = { id: "view /?id", expires_at: "2026-10-21T09:10:00Z" }
  state.response = { view }
  const started = await startShippingRewardViewAction("SHOP /1", "áo/thun?x=1")
  assert.deepEqual(started, { success: true, message: "", data: view })
  assert.equal(started.data.code, undefined)
  assert.deepEqual(state.calls[0], {
    method: "POST",
    path: `${productPath}/shipping-offer/views`,
    cache: "no-store",
  })

  state.response = {
    message: "Đã nhận mã miễn phí vận chuyển.",
    shipping_discount_code: reward,
  }
  const redeemed = await redeemShippingRewardAction(
    "SHOP /1",
    "áo/thun?x=1",
    started.data.id
  )
  assert.deepEqual(redeemed, {
    success: true,
    message: state.response.message,
    data: reward,
  })
  assert.deepEqual(state.calls[1], {
    method: "POST",
    path: `${productPath}/shipping-offer/views/view%20%2F%3Fid/redeem`,
    cache: "no-store",
  })
  assert.ok(state.calls.every((call) => call.body === undefined))
})

test("persisted code lookup reads the product-specific server code and preserves no-code null", async () => {
  for (const code of [reward, null]) {
    state.response = { shipping_discount_code: code }
    const result = await loadShippingDiscountCodeAction(
      "SHOP /1",
      "áo/thun?x=1"
    )
    assert.deepEqual(result, { success: true, message: "", data: code })
    assert.deepEqual(state.calls.at(-1), {
      method: "GET",
      path: `${productPath}/shipping-offer/code`,
      cache: "no-store",
    })
  }
})

test("all shipping reward actions normalize expired sessions to a login message", async () => {
  state.error = new ApiError(401, { message: "Unauthenticated." })
  for (const action of actions) {
    const result = await action("SHOP-1", "ao-thun")
    assert.equal(result.success, false)
    assert.equal(
      result.message,
      "Vui lòng đăng nhập để nhận mã miễn phí vận chuyển."
    )
    assert.equal(result.data, undefined)
  }
})

test("API validation failures preserve the server message and fields without returning a code", async () => {
  const errors = { view: ["Phiên nhận ưu đãi đã hết hạn."] }
  state.error = new ApiError(422, {
    message: "Ưu đãi vận chuyển không còn khả dụng.",
    errors,
  })
  const result = await redeemShippingRewardAction("SHOP-1", "ao-thun", "view")
  assert.deepEqual(result, {
    success: false,
    message: state.error.message,
    errors,
  })
})

test("unexpected failures return a retry message without exposing upstream details or inventing data", async () => {
  state.error = new Error("Private database credentials or connection failure")
  for (const action of actions) {
    assert.deepEqual(await action("SHOP-1", "ao-thun"), {
      success: false,
      message: "Không thể xử lý ưu đãi vận chuyển. Vui lòng thử lại.",
    })
  }
})
