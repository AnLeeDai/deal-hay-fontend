import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const apiUrl = moduleUrl(`
  export class ApiError extends Error {
    constructor(message, errors) { super(message); this.errors = errors }
  }
  export const requests = []
  export async function apiFetch(options) {
    requests.push(options)
    if (globalThis.__inventoryUnitError) throw globalThis.__inventoryUnitError
    return { data: [], meta: { current_page: options.searchParams.page, last_page: 1, total: 0, per_page: options.searchParams.per_page } }
  }
`)
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL(
      "../src/modules/shop-management/inventory-unit-actions.ts",
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
const source = outputText
  .replace('from "zod"', `from "${import.meta.resolve("zod")}"`)
  .replace('from "@/api/client"', `from "${apiUrl}"`)
const { listInventoryUnitsAction } = await import(moduleUrl(source))
const { requests, ApiError } = await import(apiUrl)
test.beforeEach(() => {
  requests.length = 0
  delete globalThis.__inventoryUnitError
})

test("unit browsing requests the authenticated private endpoint and keeps pagination server-side", async () => {
  const result = await listInventoryUnitsAction({
    page: 3,
    search: "  DHU-0001  ",
    product_id: "019a10bf-e4d2-7000-8000-111111111111",
  })
  assert.equal(result.success, true)
  assert.deepEqual(requests, [
    {
      path: "/private/shop/inventory-units",
      searchParams: {
        page: 3,
        per_page: 100,
        search: "DHU-0001",
        product_id: "019a10bf-e4d2-7000-8000-111111111111",
      },
    },
  ])
  assert.equal(result.data.meta.current_page, 3)
  await listInventoryUnitsAction({ per_page: 200 })
  assert.equal(requests[1].searchParams.per_page, 200)
})

test("invalid product identifiers, pagination and excessive search text are rejected before contacting the API", async () => {
  for (const filters of [
    { product_id: "another-shop/id" },
    { page: 0 },
    { page: 1.2 },
    { per_page: 201 },
    { per_page: 0 },
    { search: "x".repeat(201) },
  ]) {
    assert.equal((await listInventoryUnitsAction(filters)).success, false)
  }
  assert.equal(requests.length, 0)
})

test("browsing failures return useful validation errors and allow retrying without inventing local units", async () => {
  globalThis.__inventoryUnitError = new ApiError("Yêu cầu không hợp lệ.", {
    search: ["Từ khóa không hợp lệ."],
  })
  assert.deepEqual(await listInventoryUnitsAction(), {
    success: false,
    message: "Từ khóa không hợp lệ.",
  })
  globalThis.__inventoryUnitError = new Error("upstream connection failure")
  assert.match(
    (await listInventoryUnitsAction()).message,
    /Không thể tải danh sách/
  )
  delete globalThis.__inventoryUnitError
  assert.equal((await listInventoryUnitsAction()).success, true)
  assert.ok(
    requests.every(({ method }) => method === undefined || method === "GET")
  )
})

const { outputText: detailOutput } = ts.transpileModule(
  readFileSync(
    new URL(
      "../src/modules/shop-management/inventory-unit-detail-actions.ts",
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
const { listStocktakeUnitsAction } = await import(
  moduleUrl(
    detailOutput
      .replace('from "zod"', `from "${import.meta.resolve("zod")}"`)
      .replace('from "@/api/client"', `from "${apiUrl}"`)
  )
)
const stocktakeId = "019a10bf-e4d2-7000-8000-111111111111"
const itemId = "019a10bf-e4d2-7000-8000-222222222222"

test("stocktake unit details use the private nested item endpoint and page100 contract", async () => {
  const result = await listStocktakeUnitsAction(stocktakeId, itemId, 3)
  assert.equal(result.success, true)
  assert.deepEqual(requests, [
    {
      path: `/private/shop/stocktakes/${stocktakeId}/items/${itemId}/units`,
      searchParams: { page: 3, per_page: 100 },
    },
  ])
  assert.equal(result.data.meta.current_page, 3)
})

test("stocktake detail requests reject malformed identities and pages above the100unit limit", async () => {
  for (const args of [
    ["invalid", itemId],
    [stocktakeId, "invalid"],
    [stocktakeId, itemId, 0],
    [stocktakeId, itemId, 1.5],
    [stocktakeId, itemId, 1, 101],
  ]) {
    assert.equal((await listStocktakeUnitsAction(...args)).success, false)
  }
  assert.equal(requests.length, 0)
  globalThis.__inventoryUnitError = new Error("backend temporarily offline")
  assert.match(
    (await listStocktakeUnitsAction(stocktakeId, itemId)).message,
    /Không thể tải chi tiết/
  )
  delete globalThis.__inventoryUnitError
  assert.equal(
    (await listStocktakeUnitsAction(stocktakeId, itemId)).success,
    true
  )
})
