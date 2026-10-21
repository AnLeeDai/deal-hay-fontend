import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
}

const apiUrl = moduleUrl(`
  export class ApiError extends Error {
    constructor(status, payload) {
      super(payload.message)
      this.status = status
      this.errors = payload.errors
    }
  }
  export const state = { calls: [], error: undefined, quote: undefined }
  export async function apiFetch(options) {
    state.calls.push(options)
    if (state.error) throw state.error
    return { shipping_quote: state.quote }
  }
`)
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL("../src/modules/public/shipping-actions.ts", import.meta.url),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
)
const { loadShippingQuoteAction } = await import(
  moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (_match, quote, specifier) => {
      assert.equal(specifier, "@/api/client", `Unmocked import: ${specifier}`)
      return `from ${quote}${apiUrl}${quote}`
    })
  )
)
const { ApiError, state } = await import(apiUrl)

test.beforeEach(() => {
  state.calls.length = 0
  state.error = undefined
  state.quote = {
    eligible: true,
    configured: true,
    fee: 15000,
    province_code: 1,
    ward_code: 70,
    reason: null,
  }
})

test("quotes encode product paths and send location without client fees or discounts", async () => {
  const result = await loadShippingQuoteAction(
    "SHOP /1",
    "áo/thun?x=1",
    "1",
    "70",
    { shipping_fee: 1, shipping_discount_amount: 99999, total: 0 }
  )
  assert.deepEqual(state.calls, [
    {
      method: "POST",
      path: "/shops/SHOP%20%2F1/products/%C3%A1o%2Fthun%3Fx%3D1/shipping-quote",
      body: { shipping_province_code: 1, shipping_ward_code: 70 },
      cache: "no-store",
    },
  ])
  assert.equal(result.success, true)
  assert.deepEqual(result.data, state.quote)
})

test("unknown shipping fees remain null for unconfigured and non-Hanoi locations", async () => {
  for (const reason of ["not_configured", "outside_hanoi"]) {
    state.quote = {
      eligible: reason !== "outside_hanoi",
      configured: false,
      fee: null,
      province_code: reason === "outside_hanoi" ? 79 : 1,
      ward_code: 70,
      reason,
    }
    const result = await loadShippingQuoteAction(
      "SHOP-1",
      "ao-thun",
      String(state.quote.province_code),
      "70"
    )
    assert.equal(result.success, true)
    assert.equal(result.data.fee, null)
    assert.equal(result.data.reason, reason)
  }
})

test("malformed and unsafe location codes do not request a quote", async () => {
  for (const code of [
    "",
    "0",
    "-1",
    "1.5",
    "1e3",
    " 1",
    "1 OR 1",
    "NaN",
    "Infinity",
    "9007199254740992",
    "9".repeat(400),
  ]) {
    for (const [province, ward] of [
      [code, "70"],
      ["1", code],
    ]) {
      const result = await loadShippingQuoteAction(
        "SHOP-1",
        "ao-thun",
        province,
        ward
      )
      assert.equal(
        result.success,
        false,
        `Invalid location: ${province}/${ward}`
      )
      assert.equal(result.data, undefined)
    }
  }
  assert.deepEqual(state.calls, [])
})

test("backend validation errors are reported without fabricating a quote", async () => {
  state.error = new ApiError(422, {
    message: "Phường/xã không thuộc tỉnh/thành đã chọn.",
  })
  const result = await loadShippingQuoteAction("SHOP-1", "ao-thun", "1", "70")
  assert.equal(result.success, false)
  assert.equal(result.message, state.error.message)
  assert.equal(result.data, undefined)
})

test("unexpected failures return a retry message without a stale or zero quote", async () => {
  state.error = new Error("Private upstream connection failure")
  const result = await loadShippingQuoteAction("SHOP-1", "ao-thun", "1", "70")
  assert.equal(result.success, false)
  assert.equal(
    result.message,
    "Chưa lấy được phí vận chuyển. Vui lòng thử lại."
  )
  assert.equal(result.data, undefined)
})
