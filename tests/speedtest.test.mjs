import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL("../src/modules/diagnostics/lib/speedtest.ts", import.meta.url),
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
  measureSpeedtest,
  median,
  jitterMs,
  throughputMbps,
  initialSpeedtestState,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
)
const MIB = 1024 * 1024
const session = () => ({
  token: "g".repeat(64),
  endpointUrl: "/api/speedtest",
  expiresAt: "2026-10-24T10:00:00Z",
  limits: {
    max_download_bytes: 4 * MIB,
    max_upload_bytes: 2 * MIB,
    max_session_bytes: 64 * MIB,
    max_requests: 64,
  },
})

function harness({
  override,
  grant = session(),
  fast = false,
  latency,
  linkMbps = 100,
} = {}) {
  let time = 0
  const calls = []
  const updates = []
  const transfers = { download: [], upload: [] }
  const pings =
    latency === undefined
      ? [1000, 20, 40, 30, 80, 60, 40, 20]
      : Array(8).fill(latency)
  let pingIndex = 0
  const controller = new AbortController()
  const deps = {
    now: () => time,
    payload: (size) => new Uint8Array(size).fill(127),
    async fetch(url, options) {
      assert.equal(typeof url, "string")
      assert.ok(url.startsWith("/api/speedtest/"))
      url = new URL(url, "https://www.example.test")
      const phase = url.pathname.split("/").at(-1)
      const bytes =
        phase === "download"
          ? Number(options.headers["X-Speedtest-Bytes"])
          : (options.body?.byteLength ?? 0)
      const call = { url, options, phase, bytes }
      calls.push(call)
      const replacement = await override?.(call, {
        controller,
        advance: (ms) => {
          time += ms
        },
      })
      if (replacement) return replacement
      if (phase === "ping") {
        time += pings[pingIndex++]
        return new Response(null, { status: 204 })
      }
      const index = transfers[phase].length
      const durationMs =
        latency === undefined
          ? fast
            ? 1
            : 200 + index * 75
          : latency + (bytes * 8) / (linkMbps * 1000)
      transfers[phase].push({ bytes, durationMs })
      time += durationMs / 4 // Time until response headers, excluding most body transfer.
      if (phase === "upload") {
        return {
          ok: true,
          status: 200,
          json: async () => {
            time += (durationMs * 3) / 4
            return { received_bytes: bytes }
          },
        }
      }
      let chunks = 0
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/octet-stream" }),
        body: {
          getReader: () => ({
            async read() {
              if (chunks === 2) return { done: true }
              time += (durationMs * 3) / 8
              const size =
                chunks++ === 0
                  ? Math.floor(bytes / 2)
                  : bytes - Math.floor(bytes / 2)
              return { done: false, value: new Uint8Array(size) }
            },
            releaseLock() {},
            cancel: async () => {},
          }),
        },
      }
    },
  }
  return {
    calls,
    updates,
    transfers,
    controller,
    run: () =>
      measureSpeedtest(
        grant,
        controller.signal,
        (state) => updates.push(state),
        deps
      ),
  }
}

test("calculates Mbps, median RTT and adjacent-sample jitter without mutating samples", () => {
  assert.equal(throughputMbps(1_000_000, 1000), 8)
  assert.equal(throughputMbps(100, 0), 0)
  assert.equal(throughputMbps(0, 100), 0)
  const samples = [80, 20, 40, 30]
  assert.equal(median(samples), 35)
  assert.deepEqual(samples, [80, 20, 40, 30])
  assert.equal(jitterMs([20, 40, 30]), 15)
  assert.equal(jitterMs([20]), 0)
  assert.equal(initialSpeedtestState().pingMs, null)
  assert.equal(initialSpeedtestState().downloadMbps, null)
})

test("measures the browser API path with a discarded warmup and weighted full-body speeds", async () => {
  const h = harness()
  const result = await h.run()
  assert.equal(result.phase, "complete")
  assert.equal(result.serverName, "DealHay Backend")
  assert.equal(result.pingMs, 40)
  assert.equal(result.jitterMs, 140 / 6)
  assert.equal(h.calls.length, 20)
  assert.equal(h.calls.filter((call) => call.phase === "ping").length, 8)
  assert.equal(result.progress, 100)
  assert.ok(result.completedAt)
  for (const phase of ["download", "upload"]) {
    const measured = h.transfers[phase]
    assert.equal(result.samples[phase].length, 6)
    const bytes = measured.reduce((sum, item) => sum + item.bytes, 0)
    const duration = measured.reduce((sum, item) => sum + item.durationMs, 0)
    assert.equal(result[`${phase}Mbps`], throughputMbps(bytes, duration))
    assert.deepEqual(
      result.samples[phase].map((sample) => sample.mbps),
      measured.map((item) => throughputMbps(item.bytes, item.durationMs))
    )
    assert.notEqual(
      result[`${phase}Mbps`],
      result.samples[phase].reduce((sum, item) => sum + item.mbps, 0) / 6
    )
  }
  assert.equal(
    result.transferredBytes,
    h.calls.reduce((sum, call) => sum + call.bytes, 0)
  )
  assert.ok(
    h.updates.some(
      (update) =>
        update.phase === "download" &&
        update.liveMbps !== null &&
        update.samples.download.length === 0
    )
  )
  assert.ok(
    h.updates.every(
      (update, index) =>
        index === 0 || update.progress >= h.updates[index - 1].progress
    )
  )
  for (const { url, options, phase, bytes } of h.calls) {
    assert.equal(url.origin, "https://www.example.test")
    assert.equal(url.pathname, `/api/speedtest/${phase}`)
    assert.equal(options.mode, "same-origin")
    assert.equal(options.headers.Authorization, `Bearer ${session().token}`)
    assert.equal(options.credentials, "omit")
    assert.equal(options.cache, "default")
    assert.equal(options.redirect, "error")
    assert.equal(url.search, "")
    if (phase === "upload") {
      assert.equal(options.method, "POST")
      assert.equal(options.headers["Content-Type"], "application/octet-stream")
      assert.equal(options.body.byteLength, bytes)
      assert.equal(options.body[0], 127)
    } else assert.equal(options.method, "GET")
  }
  // Varying the URL would force a fresh preflight round trip per sample.
  for (const phase of ["ping", "download", "upload"]) {
    assert.equal(
      new Set(
        h.calls
          .filter((call) => call.phase === phase)
          .map((call) => call.url.href)
      ).size,
      1
    )
  }
})

test("caps adaptive transfer sizes and total data even on an extremely fast connection", async () => {
  const h = harness({ fast: true })
  const result = await h.run()
  assert.ok(h.transfers.download.some((sample) => sample.bytes === 4 * MIB))
  assert.ok(h.transfers.upload.some((sample) => sample.bytes === 2 * MIB))
  assert.ok(h.transfers.download.every((sample) => sample.bytes <= 4 * MIB))
  assert.ok(h.transfers.upload.every((sample) => sample.bytes <= 2 * MIB))
  assert.ok(result.transferredBytes <= 36 * MIB)
})

test("high RTT grows transfer packets instead of collapsing into a 64 KiB speed ceiling", async () => {
  const h = harness({ latency: 1810, linkMbps: 100 })
  const result = await h.run()
  assert.equal(result.pingMs, 1810)
  assert.ok(h.transfers.download.some((sample) => sample.bytes === 4 * MIB))
  assert.ok(h.transfers.upload.some((sample) => sample.bytes === 2 * MIB))
  for (const phase of ["download", "upload"]) {
    const samples = h.transfers[phase]
    assert.ok(
      samples
        .slice(1)
        .every((sample, index) => sample.bytes >= samples[index].bytes)
    )
    const measuredMbps = throughputMbps(
      samples.reduce((sum, item) => sum + item.bytes, 0),
      samples.reduce((sum, item) => sum + item.durationMs, 0)
    )
    assert.ok(Math.abs(result[`${phase}Mbps`] - measuredMbps) < 1e-8)
    assert.ok(result[`${phase}Mbps`] > 1)
    assert.ok(
      result[`${phase}Mbps`] < 100,
      "keep real response wait in effective HTTP throughput"
    )
  }
  assert.equal(h.calls.length, 20)
  assert.ok(result.transferredBytes <= 36 * MIB)
})

test("honors smaller server limits rather than assuming default chunk sizes", async () => {
  const grant = session()
  grant.limits.max_download_bytes = 20_000
  grant.limits.max_upload_bytes = 10_000
  const h = harness({ grant })
  const result = await h.run()
  assert.equal(result.transferredBytes, 180_000)
  assert.ok(h.transfers.download.every((sample) => sample.bytes === 20_000))
  assert.ok(h.transfers.upload.every((sample) => sample.bytes === 10_000))
})

test("stops before exceeding a grant byte or request budget", async () => {
  for (const [key, value] of [
    ["max_session_bytes", 10],
    ["max_requests", 1],
  ]) {
    const grant = session()
    grant.limits[key] = value
    const h = harness({ grant })
    await assert.rejects(h.run(), /giới hạn dữ liệu/)
    assert.ok(h.calls.length <= (key === "max_requests" ? 1 : 8))
    assert.ok(!h.updates.some((state) => state.phase === "complete"))
  }
})

test("requires exact downloaded bytes and server upload acknowledgement before reporting success", async () => {
  for (const [phase, response, message] of [
    [
      "download",
      () => new Response("<html>error</html>"),
      /Phản hồi tải xuống không hợp lệ/,
    ],
    [
      "download",
      () =>
        new Response(new Uint8Array(32), {
          headers: { "Content-Type": "application/octet-stream" },
        }),
      /chưa đầy đủ/,
    ],
    [
      "download",
      () =>
        new Response(new Uint8Array(MIB), {
          headers: { "Content-Type": "application/octet-stream" },
        }),
      /vượt quá kích thước/,
    ],
    ["upload", () => Response.json({ received_bytes: 0 }), /chưa xác nhận đủ/],
    [
      "upload",
      () => Response.json({ received_bytes: "131072" }),
      /chưa xác nhận đủ/,
    ],
  ]) {
    const h = harness({
      override: (call) => (call.phase === phase ? response() : undefined),
    })
    await assert.rejects(h.run(), message)
    assert.ok(!h.updates.some((state) => state.phase === "complete"))
  }
})

test("rejects non-204 ping responses and handles expired, limited, failed, or unreachable probes", async () => {
  for (const [status, pattern] of [
    [200, /ping không hợp lệ/],
    [401, /hết hạn/],
    [403, /hết hạn/],
    [429, /đợi một phút/],
    [502, /chưa phản hồi/],
  ]) {
    const h = harness({ override: () => new Response(null, { status }) })
    await assert.rejects(h.run(), pattern)
    assert.equal(h.calls.length, 1)
  }
  const h = harness({
    override: () => {
      throw new TypeError("Failed to fetch: private-network-details")
    },
  })
  await assert.rejects(h.run(), {
    message: "Không kết nối được đến máy chủ đo. Vui lòng thử lại.",
  })
})

test("user cancellation aborts a pending request and prevents later requests or completion", async () => {
  const h = harness({
    override: (call, { controller }) =>
      new Promise((_resolve, reject) => {
        call.options.signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true }
        )
        queueMicrotask(() => controller.abort())
      }),
  })
  await assert.rejects(h.run(), { name: "AbortError" })
  assert.equal(h.calls.length, 1)
  assert.ok(h.calls[0].options.signal.aborted)
  assert.ok(!h.updates.some((state) => state.phase === "complete"))
  const initial = harness()
  initial.controller.abort()
  await assert.rejects(initial.run(), { name: "AbortError" })
  assert.equal(initial.calls.length, 0)
})

test("times out an unresponsive request with a recoverable message", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const h = harness({
    override: (call) =>
      new Promise((_resolve, reject) => {
        call.options.signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true }
        )
      }),
  })
  const result = h.run()
  t.mock.timers.tick(15_000)
  await assert.rejects(result, /phản hồi quá chậm/)
  assert.equal(h.calls.length, 1)
})

test("rejects invalid endpoint addresses and invalid server transfer limits", async () => {
  for (const endpointUrl of [
    "file:///etc/passwd",
    "https://user:secret@api.example.test/probe",
    "https://api.example.test/probe?target=evil",
    "https://api.example.test/probe#bad",
  ]) {
    const grant = { ...session(), endpointUrl }
    const h = harness({ grant })
    await assert.rejects(h.run(), /Địa chỉ máy chủ/)
    assert.equal(h.calls.length, 0)
  }
  for (const max_download_bytes of [0, -1, NaN, 1.5]) {
    const grant = session()
    grant.limits.max_download_bytes = max_download_bytes
    await assert.rejects(harness({ grant }).run(), /Giới hạn dữ liệu/)
  }
})
