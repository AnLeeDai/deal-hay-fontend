import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const mockedEnv = moduleUrl(`
  export const env = { BACKEND_API_URL: "https://private-api.example.test/api" }
`)
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL("../src/app/api/speedtest/[probe]/route.ts", import.meta.url),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
)
const proxy = await import(
  moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (_match, quote, specifier) => {
      assert.equal(specifier, "@/config/env", `Unmocked import: ${specifier}`)
      return `from ${quote}${mockedEnv}${quote}`
    })
  )
)

const MIB = 1024 * 1024
const GRANT = "g".repeat(64)
const ACCOUNT_TOKEN = "123|private-account-token"
const originalFetch = globalThis.fetch
let calls
let upstream
let fetchOverride
globalThis.fetch = async (url, options) => {
  const call = { url: new URL(url), options }
  calls.push(call)
  if (options.body) {
    call.bodyBytes = new Uint8Array(
      await new Response(options.body).arrayBuffer()
    )
    const length = new Headers(options.headers).get("Content-Length")
    if (length !== null && Number(length) !== call.bodyBytes.byteLength)
      throw new TypeError("Request body length does not match content-length")
  }
  return fetchOverride ? fetchOverride(call) : upstream
}
test.beforeEach(() => {
  calls = []
  fetchOverride = null
  upstream = new Response(null, { status: 204 })
})
test.after(() => {
  globalThis.fetch = originalFetch
})

function request(
  probe,
  { method = "GET", headers, body, signal, query = "" } = {}
) {
  return new Request(
    `https://dealhay.example.test/api/speedtest/${probe}${query}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${GRANT}`,
        Origin: "https://dealhay.example.test",
        "Sec-Fetch-Site": "same-origin",
        Cookie: `dealhay_access_token=${ACCOUNT_TOKEN}`,
        ...headers,
      },
      body,
      signal,
      ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
    }
  )
}

function invoke(probe, options = {}) {
  const input = request(probe, options)
  return proxy[options.method ?? "GET"](input, {
    params: Promise.resolve({ probe }),
  })
}

async function assertSafeError(response, status) {
  assert.equal(response.status, status)
  assert.match(response.headers.get("Cache-Control"), /no-store/)
  assert.equal(response.headers.get("Location"), null)
  assert.equal(response.headers.get("Set-Cookie"), null)
  const body = await response.text()
  assert.doesNotMatch(
    body,
    /private-api|private-service|private-account-token|private database|\.example\.test|https?:\/\//
  )
  const error = JSON.parse(body)
  assert.equal(typeof error.message, "string")
  assert.ok(error.message.length > 0)
}

test("ping forwards only the scoped grant to a fixed private destination", async () => {
  upstream = new Response(null, {
    status: 204,
    headers: {
      "Server-Timing": "app;dur=3",
      "Set-Cookie": "upstream=private-service",
      Location: "https://private-api.example.test/internal",
      Server: "private-service",
      "X-Powered-By": "private-service",
    },
  })
  const response = await invoke("ping", {
    headers: {
      "X-Forwarded-Host": "untrusted.example.test",
      "X-Internal-Debug": "private-service",
    },
  })
  assert.equal(response.status, 204)
  assert.equal(await response.text(), "")
  assert.equal(calls.length, 1)
  assert.equal(
    calls[0].url.href,
    "https://private-api.example.test/api/diagnostics/speedtest/ping"
  )
  const options = calls[0].options
  const headers = new Headers(options.headers)
  assert.equal(options.method, "GET")
  assert.equal(options.redirect, "error")
  assert.equal(options.credentials, "omit")
  assert.equal(options.cache, "no-store")
  assert.equal(headers.get("Authorization"), `Bearer ${GRANT}`)
  for (const name of [
    "Cookie",
    "Origin",
    "X-Forwarded-Host",
    "X-Internal-Debug",
  ]) {
    assert.equal(headers.get(name), null)
  }
  assert.ok(options.signal instanceof AbortSignal)
  assert.match(response.headers.get("Cache-Control"), /no-store/)
  assert.equal(response.headers.get("Server-Timing"), "app;dur=3")
  for (const name of ["Location", "Set-Cookie", "Server", "X-Powered-By"]) {
    assert.equal(response.headers.get(name), null)
  }
})

test("rejects arbitrary probes, query targets, and unsupported method pairs", async () => {
  for (const probe of ["auth", "session", "../auth/me", "download/extra"]) {
    await assertSafeError(await invoke(probe), 404)
  }
  await assertSafeError(
    await invoke("ping", {
      query: "?url=https%3A%2F%2Funtrusted.example.test%2Fprivate",
    }),
    400
  )
  for (const [probe, method] of [
    ["upload", "GET"],
    ["ping", "POST"],
    ["download", "POST"],
  ]) {
    await assertSafeError(await invoke(probe, { method }), 405)
  }
  assert.equal(calls.length, 0)
})

test("rejects account credentials, malformed grants, and cross-site browser requests", async () => {
  for (const authorization of [
    "",
    `Bearer ${ACCOUNT_TOKEN}`,
    `Bearer ${"g".repeat(63)}`,
    `Bearer ${"g".repeat(65)}`,
    `Bearer ${"!".repeat(64)}`,
    `Bearer ${GRANT} extra`,
    `Basic ${GRANT}`,
  ]) {
    await assertSafeError(
      await invoke("ping", { headers: { Authorization: authorization } }),
      401
    )
  }
  for (const headers of [
    { Origin: "https://untrusted.example.test" },
    { Origin: "null" },
    { "Sec-Fetch-Site": "cross-site" },
  ]) {
    await assertSafeError(await invoke("ping", { headers }), 403)
  }
  assert.equal(calls.length, 0)
})

test("validates download sizes before forwarding a bounded probe", async () => {
  for (const bytes of ["0", "-1", "1.5", "1e3", "NaN", String(4 * MIB + 1)]) {
    await assertSafeError(
      await invoke("download", { headers: { "X-Speedtest-Bytes": bytes } }),
      422
    )
  }
  assert.equal(calls.length, 0)
  upstream = new Response(new Uint8Array(MIB), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(MIB),
      "Content-Encoding": "identity",
      "X-Speedtest-Bytes": String(MIB),
    },
  })
  const response = await invoke("download")
  assert.equal(response.status, 200)
  assert.equal(
    new Headers(calls[0].options.headers).get("X-Speedtest-Bytes"),
    String(MIB)
  )
  assert.equal((await response.arrayBuffer()).byteLength, MIB)
})

test(
  "streams download bytes without waiting for the entire upstream body",
  { timeout: 1000 },
  async () => {
    let writer
    upstream = new Response(
      new ReadableStream({
        start(controller) {
          writer = controller
        },
      }),
      {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": "4",
          "Content-Encoding": "identity",
          "X-Speedtest-Bytes": "4",
          "Cache-Control": "public,max-age=3600",
          Location: "https://private-api.example.test/hidden",
        },
      }
    )
    const response = await invoke("download", {
      headers: { "X-Speedtest-Bytes": "4" },
    })
    assert.equal(response.status, 200)
    assert.match(response.headers.get("Cache-Control"), /no-store/)
    assert.equal(
      response.headers.get("Content-Type"),
      "application/octet-stream"
    )
    assert.equal(response.headers.get("Content-Length"), "4")
    assert.equal(response.headers.get("Content-Encoding"), "identity")
    assert.equal(response.headers.get("X-Speedtest-Bytes"), "4")
    assert.equal(response.headers.get("Location"), null)
    const reader = response.body.getReader()
    writer.enqueue(new Uint8Array([1, 2]))
    assert.deepEqual((await reader.read()).value, new Uint8Array([1, 2]))
    writer.enqueue(new Uint8Array([3, 4]))
    writer.close()
    assert.deepEqual((await reader.read()).value, new Uint8Array([3, 4]))
    assert.equal((await reader.read()).done, true)
    reader.releaseLock()
  }
)

test("rejects unexpected upstream download content and length headers", async () => {
  for (const headers of [
    { "Content-Type": "text/html", "Content-Length": "4" },
    { "Content-Type": "application/octet-stream" },
    { "Content-Type": "application/octet-stream", "Content-Length": "0" },
    { "Content-Type": "application/octet-stream", "Content-Length": "5" },
    { "Content-Type": "application/octet-stream", "Content-Length": "4.5" },
  ]) {
    upstream = new Response("private-service", { headers })
    await assertSafeError(
      await invoke("download", { headers: { "X-Speedtest-Bytes": "4" } }),
      503
    )
  }
})

test("forwards bounded raw uploads and returns only a validated byte acknowledgement", async () => {
  const bytes = new Uint8Array([10, 20, 30, 40, 50])
  upstream = Response.json({
    received_bytes: bytes.byteLength,
    debug: "https://private-api.example.test/internal",
  })
  const response = await invoke("upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
    },
    body: bytes,
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { received_bytes: bytes.byteLength })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url.pathname, "/api/diagnostics/speedtest/upload")
  const options = calls[0].options
  const headers = new Headers(options.headers)
  assert.equal(options.method, "POST")
  assert.equal(headers.get("Content-Type"), "application/octet-stream")
  assert.equal(headers.get("Cookie"), null)
  assert.deepEqual(calls[0].bodyBytes, bytes)
  assert.match(response.headers.get("Cache-Control"), /no-store/)
})

test("rejects invalid upload media types, lengths, missing data, and oversized streams", async () => {
  for (const contentType of ["image/webp", "text/plain", "application/json"]) {
    await assertSafeError(
      await invoke("upload", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: new Uint8Array([1]),
      }),
      415
    )
  }
  for (const length of ["-1", "NaN", "1.5", "1e3"]) {
    await assertSafeError(
      await invoke("upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": length,
        },
        body: new Uint8Array([1]),
      }),
      400
    )
  }
  await assertSafeError(
    await invoke("upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(2 * MIB + 1),
      },
      body: new Uint8Array([1]),
    }),
    413
  )
  assert.equal(calls.length, 0)
  await assertSafeError(
    await invoke("upload", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
    }),
    400
  )
  await assertSafeError(
    await invoke("upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": "2",
      },
      body: new Uint8Array([1]),
    }),
    400
  )
  let cancelled = false
  let chunk = 0
  await assertSafeError(
    await invoke("upload", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new ReadableStream({
        pull(controller) {
          if (chunk++ < 2) controller.enqueue(new Uint8Array(MIB))
          else controller.enqueue(new Uint8Array([1]))
        },
        cancel() {
          cancelled = true
        },
      }),
    }),
    413
  )
  assert.equal(cancelled, true)
  assert.equal(calls.length, 2)
  assert.equal(calls.at(-1).options.signal.aborted, true)
})

test("rejects invalid upload acknowledgements rather than exposing upstream payloads", async () => {
  for (const payload of [
    { received_bytes: "1", debug: "private-service" },
    { received_bytes: -1 },
    { received_bytes: 2 * MIB + 1 },
    { received_bytes: 1.5 },
    { debug: "https://private-api.example.test/internal" },
  ]) {
    upstream = Response.json(payload)
    await assertSafeError(
      await invoke("upload", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Uint8Array([1]),
      }),
      503
    )
  }
})

test("sanitizes upstream failures and redirects while retaining useful retry information", async () => {
  for (const status of [400, 401, 403, 413, 415, 422, 429, 503]) {
    upstream = new Response(
      "private database at https://private-api.example.test",
      {
        status,
        headers: {
          "Retry-After": "60",
          "Set-Cookie": "private-service=secret",
          Location: "https://private-api.example.test/internal",
        },
      }
    )
    const response = await invoke("ping")
    assert.equal(response.headers.get("Retry-After"), "60")
    await assertSafeError(response, status)
  }
  for (const status of [301, 302, 500, 502, 504]) {
    upstream = new Response("https://private-api.example.test", {
      status,
      headers: { Location: "https://private-api.example.test/internal" },
    })
    await assertSafeError(await invoke("ping"), 503)
  }
  fetchOverride = async () => {
    throw new Error(
      "private-service at https://private-api.example.test failed"
    )
  }
  await assertSafeError(await invoke("ping"), 503)
})

test(
  "cancels the upstream request when the browser aborts",
  { timeout: 1000 },
  async () => {
    const browser = new AbortController()
    let entered
    const fetchStarted = new Promise((resolve) => {
      entered = resolve
    })
    fetchOverride = ({ options }) => {
      entered(options)
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          "abort",
          () =>
            reject(new DOMException("private-service aborted", "AbortError")),
          { once: true }
        )
      })
    }
    const pending = invoke("ping", { signal: browser.signal })
    const options = await fetchStarted
    browser.abort()
    assert.equal(options.signal.aborted, true)
    await assertSafeError(await pending, 503)
  }
)

test(
  "keeps cancellation active after streaming response headers are returned",
  { timeout: 1000 },
  async () => {
    const browser = new AbortController()
    fetchOverride = ({ options }) => {
      const body = new ReadableStream({
        start(controller) {
          options.signal.addEventListener(
            "abort",
            () => controller.error(new DOMException("Aborted", "AbortError")),
            { once: true }
          )
        },
      })
      return new Response(body, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": "4",
        },
      })
    }
    const response = await invoke("download", {
      signal: browser.signal,
      headers: { "X-Speedtest-Bytes": "4" },
    })
    const reading = response.arrayBuffer()
    browser.abort()
    assert.equal(calls[0].options.signal.aborted, true)
    await assert.rejects(reading, { name: "AbortError" })
  }
)

test(
  "cancels the upstream stream when the browser stops reading",
  { timeout: 1000 },
  async () => {
    let cancelled = false
    upstream = new Response(
      new ReadableStream({
        cancel() {
          cancelled = true
        },
      }),
      {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": "4",
        },
      }
    )
    const response = await invoke("download", {
      headers: { "X-Speedtest-Bytes": "4" },
    })
    await response.body.cancel("Browser stopped reading")
    assert.equal(cancelled, true)
    assert.equal(calls[0].options.signal.aborted, true)
  }
)

test(
  "rejects truncated and oversized streamed bodies after valid download headers",
  { timeout: 1000 },
  async () => {
    upstream = new Response(new Uint8Array([1, 2, 3]), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": "4",
      },
    })
    let response = await invoke("download", {
      headers: { "X-Speedtest-Bytes": "4" },
    })
    await assert.rejects(response.arrayBuffer(), (error) => {
      assert.doesNotMatch(error.message, /private-api|https?:\/\//)
      return true
    })

    let cancelled = false
    upstream = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4, 5]))
        },
        cancel() {
          cancelled = true
        },
      }),
      {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": "4",
        },
      }
    )
    response = await invoke("download", {
      headers: { "X-Speedtest-Bytes": "4" },
    })
    await assert.rejects(response.arrayBuffer(), (error) => {
      assert.doesNotMatch(error.message, /private-api|https?:\/\//)
      return true
    })
    assert.equal(cancelled, true)
    assert.equal(calls.at(-1).options.signal.aborted, true)
  }
)
