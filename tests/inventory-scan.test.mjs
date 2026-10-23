import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
}
function transpile(path, imports = {}) {
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
    outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
      assert.ok(imports[name], `Unexpected import ${name}`)
      return `from ${quote}${imports[name]}${quote}`
    })
  )
}
const scanModuleUrl = transpile(
  "../src/modules/shop-management/lib/inventory-scan.ts"
)
const {
  InventoryScanQueue,
  createInventoryScanId,
  normalizeInventoryScanCode,
} = await import(scanModuleUrl)
const apiUrl = moduleUrl(
  `export class ApiError extends Error {}\nexport const apiFetch = (options) => globalThis.inventoryScanTestApi(options)`
)
const { scanStocktakeAction } = await import(
  transpile("../src/modules/shop-management/inventory-actions.ts", {
    zod: import.meta.resolve("zod"),
    "next/cache": moduleUrl("export function revalidatePath() {}"),
    "@/api/client": apiUrl,
    "@/modules/shop-management/lib/inventory-scan": scanModuleUrl,
  })
)
const sessionId = "019a10bf-e4d2-7000-8000-111111111111"
const otherSessionId = "019a10bf-e4d2-7000-8000-222222222222"
const firstSku = "DHU-019A10BF-E4D2-7000-8000-333333333333"
const secondSku = "DHU-019A10BF-E4D2-7000-8000-444444444444"
function ids() {
  let sequence = 0
  return () => `019a10bf-e4d2-7000-8000-${String(++sequence).padStart(12, "0")}`
}
function deferred() {
  let resolve
  const promise = new Promise((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
function send(job) {
  return scanStocktakeAction(job.sessionId, job.code, 1, job.id)
}
test.afterEach(() => {
  delete globalThis.inventoryScanTestApi
})

test("scanner suffixes normalize to one plain SKU and embedded codes are rejected", () => {
  assert.equal(
    normalizeInventoryScanCode(
      `\ufeff\0\t ${firstSku.toLowerCase()}\r\n\t\x1d\x7f`
    ),
    firstSku
  )
  assert.equal(normalizeInventoryScanCode("  sku-123  "), "SKU-123")
  for (const invalid of [
    null,
    undefined,
    "",
    "\r\n",
    `${firstSku}\r\n${secondSku}`,
    "DHU-\t123",
  ])
    assert.equal(normalizeInventoryScanCode(invalid), "")
})

test("handheld UUID creation works without secure-context randomUUID and reports unsupported browsers", () => {
  const id = createInventoryScanId({
    getRandomValues(bytes) {
      bytes.fill(123)
      return bytes
    },
  })
  assert.match(
    id,
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
  )
  assert.equal(
    createInventoryScanId({ randomUUID: () => "native-id" }),
    "native-id"
  )
  assert.throws(() => createInventoryScanId({}), /không hỗ trợ/)
})

test("rapid handheld scans reach the real Server Action sequentially while the first API response is delayed", async () => {
  const queue = new InventoryScanQueue()
  const makeId = ids()
  const firstReply = deferred()
  const requests = []
  const received = []
  let active = 0
  let maximumActive = 0
  globalThis.inventoryScanTestApi = async (request) => {
    requests.push(request)
    active++
    maximumActive = Math.max(maximumActive, active)
    if (requests.length === 1) await firstReply.promise
    active--
    return { data: { id: sessionId, scanned: request.body.code } }
  }
  queue.enqueue(sessionId, firstSku.toLowerCase() + "\r\n", makeId)
  const draining = queue.drain(
    send,
    (job, data) => received.push([job.code, data.scanned]),
    () => {}
  )
  queue.enqueue(sessionId, secondSku + "\t", makeId)
  assert.equal(queue.snapshot().queued, 2)
  assert.equal(requests.length, 1)
  const secondDrain = queue.drain(
    send,
    () => assert.fail("parallel drain"),
    () => {}
  )
  await secondDrain
  firstReply.resolve()
  await draining
  assert.equal(maximumActive, 1)
  assert.deepEqual(received, [
    [firstSku, firstSku],
    [secondSku, secondSku],
  ])
  assert.deepEqual(
    requests.map((request) => [
      request.method,
      request.path,
      request.body.code,
      request.body.quantity,
    ]),
    [
      ["POST", `/private/shop/stocktakes/${sessionId}/scan`, firstSku, 1],
      ["POST", `/private/shop/stocktakes/${sessionId}/scan`, secondSku, 1],
    ]
  )
  assert.notEqual(requests[0].body.scan_id, requests[1].body.scan_id)
  assert.equal(queue.snapshot().queued, 0)
  assert.equal(queue.snapshot().running, false)
})

test("network failures retain all queued codes and retry the same scan ID before advancing", async () => {
  const queue = new InventoryScanQueue()
  const makeId = ids()
  const first = queue.enqueue(sessionId, firstSku, makeId)
  queue.enqueue(sessionId, secondSku, makeId)
  const requests = []
  let fail = true
  globalThis.inventoryScanTestApi = async (request) => {
    requests.push(request)
    if (fail) throw Error("connection dropped after server may have committed")
    return { data: { scanned: request.body.code } }
  }
  await queue.drain(
    send,
    () => assert.fail("failure cannot confirm a scan"),
    () => {}
  )
  assert.equal(queue.snapshot().queued, 2)
  assert.ok(queue.snapshot().error)
  assert.equal(
    queue.enqueue(sessionId, firstSku.toLowerCase(), makeId).id,
    first.id
  )
  fail = false
  const received = []
  await queue.drain(
    send,
    (job) => received.push(job.code),
    () => {}
  )
  assert.deepEqual(received, [firstSku, secondSku])
  assert.equal(requests[0].body.scan_id, requests[1].body.scan_id)
  assert.equal(queue.snapshot().error, null)
})

test("invalid-unit errors pause the queue until explicit retry or skip, without losing later scans", async () => {
  const queue = new InventoryScanQueue()
  const makeId = ids()
  queue.enqueue(sessionId, "OLD-PRODUCT-CODE", makeId)
  queue.enqueue(sessionId, firstSku, makeId)
  await queue.drain(
    async () => ({ success: false, message: "Hãy dùng SKU riêng" }),
    () => assert.fail(),
    () => {}
  )
  queue.enqueue(sessionId, secondSku, makeId)
  assert.equal(queue.snapshot().queued, 3)
  assert.equal(queue.snapshot().error, "Hãy dùng SKU riêng")
  assert.throws(
    () => queue.enqueue(otherSessionId, firstSku, makeId),
    /phiên hiện tại/
  )
  assert.equal(queue.skipFailed().code, "OLD-PRODUCT-CODE")
  const received = []
  await queue.drain(
    async (job) => ({ success: true, data: job.code }),
    (_, value) => received.push(value),
    () => {}
  )
  assert.deepEqual(received, [firstSku, secondSku])
  assert.equal(queue.snapshot().queued, 0)
})

test("repeated pending physical SKU is queued once and invalid input never reaches the transport", () => {
  const queue = new InventoryScanQueue()
  const makeId = ids()
  const first = queue.enqueue(sessionId, firstSku, makeId)
  assert.equal(
    queue.enqueue(sessionId, firstSku.toLowerCase() + "\r\n", makeId),
    first
  )
  assert.equal(queue.snapshot().queued, 1)
  for (const code of [" ", "X".repeat(256), `${firstSku}\n${secondSku}`])
    assert.throws(() => queue.enqueue(sessionId, code, makeId), /SKU hợp lệ/)
  assert.equal(queue.snapshot().queued, 1)
})
