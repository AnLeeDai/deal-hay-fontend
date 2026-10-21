import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
}

function transpileModule(relativePath, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  return moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (match, quote, specifier) => {
      assert.ok(imports[specifier], `Unmocked import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}

const schemaUrl = transpileModule(
  "../src/modules/shop-management/schemas/shipping-settings.ts",
  { zod: import.meta.resolve("zod") }
)
const apiUrl = moduleUrl(`
  export class ApiError extends Error {
    constructor(status, payload) {
      super(payload.message)
      this.status = status
      this.errors = payload.errors
    }
  }
  export const state = {
    calls: [], wards: [], revalidated: [], error: undefined,
    settings: { enabled: false, base_fee: 0, ward_rates: [] },
  }
  export async function apiFetch(options) {
    state.calls.push(options)
    if (state.error) throw state.error
    return { shipping_settings: state.settings }
  }
  export async function getWards(provinceCode) {
    state.wards.push(provinceCode)
    return [{ code: 4, name: "Phường Ba Đình", division_type: "phường" }]
  }
  export function revalidatePath(path) { state.revalidated.push(path) }
`)
const { ApiError, state } = await import(apiUrl)
const { loadShopShippingSettingsAction, updateShopShippingSettingsAction } =
  await import(
    transpileModule("../src/modules/shop-management/shipping-actions.ts", {
      "next/cache": apiUrl,
      "@/api/client": apiUrl,
      "@/api/lookups/queries": apiUrl,
      "@/modules/shop-management/schemas/shipping-settings": schemaUrl,
    })
  )

test.beforeEach(() => {
  state.calls.length = 0
  state.wards.length = 0
  state.revalidated.length = 0
  state.error = undefined
  state.settings = { enabled: false, base_fee: 0, ward_rates: [] }
})

test("loads owner settings and only Hanoi wards", async () => {
  const result = await loadShopShippingSettingsAction()
  assert.equal(result.success, true)
  assert.deepEqual(result.shipping_settings, state.settings)
  assert.deepEqual(state.calls, [{ path: "/shop/shipping-settings" }])
  assert.deepEqual(state.wards, ["1"])
  assert.equal(result.wards[0].code, 4)
})

test("rejects negative, fractional and excessive fees before making API calls", async () => {
  for (const base_fee of [-1, 1.5, 1000000000, Number.NaN]) {
    const result = await updateShopShippingSettingsAction({
      enabled: true,
      base_fee,
      ward_rates: [],
    })
    assert.equal(result.success, false)
    assert.ok(result.errors.base_fee)
  }
  assert.deepEqual(state.calls, [])
})

test("rejects repeated wards with a field error for the duplicate row", async () => {
  const result = await updateShopShippingSettingsAction({
    enabled: true,
    base_fee: 15000,
    ward_rates: [
      { ward_code: 4, fee: 10000 },
      { ward_code: 4, fee: 20000 },
    ],
  })
  assert.equal(result.success, false)
  assert.ok(result.errors["ward_rates.1.ward_code"])
  assert.deepEqual(state.calls, [])
})

test("persists explicit base and exact ward fees, preserving a zero fee", async () => {
  const values = {
    enabled: true,
    base_fee: 15000,
    ward_rates: [{ ward_code: 4, fee: 0 }],
  }
  state.settings = values
  const result = await updateShopShippingSettingsAction(values)
  assert.equal(result.success, true)
  assert.deepEqual(state.calls, [
    { method: "PUT", path: "/shop/shipping-settings", body: values },
  ])
  assert.deepEqual(result.shipping_settings, values)
  assert.deepEqual(state.revalidated, ["/shop-manage"])
})

test("surfaces backend ownership and Hanoi ward validation failures", async () => {
  state.error = new ApiError(422, {
    message: "Phường/xã phải thuộc Hà Nội.",
    errors: { "ward_rates.0.ward_code": ["Phường/xã phải thuộc Hà Nội."] },
  })
  const result = await updateShopShippingSettingsAction({
    enabled: true,
    base_fee: 15000,
    ward_rates: [{ ward_code: 99999, fee: 10000 }],
  })
  assert.equal(result.success, false)
  assert.deepEqual(result.errors, state.error.errors)
  assert.deepEqual(state.revalidated, [])

  state.error = new ApiError(403, { message: "Chỉ chủ shop được cập nhật." })
  const load = await loadShopShippingSettingsAction()
  assert.equal(load.success, false)
  assert.equal(load.shipping_settings, undefined)
  assert.equal(load.message, "Chỉ chủ shop được cập nhật.")
})
