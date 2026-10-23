import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function loadModule(file, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  return import(
    moduleUrl(
      outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, specifier) => {
        assert.ok(imports[specifier], `Unexpected import: ${specifier}`)
        return `from ${quote}${imports[specifier]}${quote}`
      })
    )
  )
}
globalThis.__liveTransportTest = { token: "private-cookie-token" }
const { GET, POST, PATCH } = await loadModule(
  "../src/app/api/live/[...path]/route.ts",
  {
    "next/headers": moduleUrl(
      `export async function cookies() { return { get() { const value = globalThis.__liveTransportTest.token; return value ? { value } : undefined } } }`
    ),
    "@/config/env": moduleUrl(
      `export const env = { NEXT_PUBLIC_API: "https://api.example.test/api" }`
    ),
    "@/lib/cookies": moduleUrl(`export const AUTH_TOKEN_COOKIE = "auth-token"`),
  }
)
const { liveApiFetch } = await loadModule("../src/api/live-client.ts")
const context = (...path) => ({ params: Promise.resolve({ path }) })

test("the live transport requires its HttpOnly session cookie", async (t) => {
  globalThis.__liveTransportTest.token = null
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw Error("Must not contact API")
  })
  const response = await GET(
    new Request("https://shop.example.test/api/live/messages"),
    context("messages")
  )
  assert.equal(response.status, 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test("the live transport rejects unlisted routes and cross-origin requests", async (t) => {
  globalThis.__liveTransportTest.token = "private-cookie-token"
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw Error("Must not contact API")
  })
  for (const path of [
    ["admin", "users"],
    ["messages", ".."],
    ["notifications", "nested", "read"],
  ]) {
    const response = await GET(
      new Request("https://shop.example.test/api/live/unknown"),
      context(...path)
    )
    assert.equal(response.status, 404)
  }
  const wrongMethod = await PATCH(
    new Request("https://shop.example.test/api/live/auth/me", {
      method: "PATCH",
    }),
    context("auth", "me")
  )
  assert.equal(wrongMethod.status, 404)
  for (const headers of [
    { origin: "https://attacker.example" },
    { "sec-fetch-site": "cross-site" },
  ]) {
    const response = await POST(
      new Request("https://shop.example.test/api/live/presence/heartbeat", {
        method: "POST",
        headers,
      }),
      context("presence", "heartbeat")
    )
    assert.equal(response.status, 403)
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test("chat requests stream to Laravel using the cookie token and preserve idempotency metadata", async (t) => {
  globalThis.__liveTransportTest.token = "private-cookie-token"
  const upstream = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.example.test/api/messages/customer-shop")
    assert.equal(
      options.headers.get("Authorization"),
      "Bearer private-cookie-token"
    )
    assert.equal(options.headers.get("Idempotency-Key"), "message-request-id")
    assert.equal(options.headers.get("X-Socket-ID"), "123.456")
    assert.equal(options.headers.get("Cookie"), null)
    assert.ok(options.body instanceof ReadableStream)
    assert.equal(options.duplex, "half")
    return Response.json({ id: "stored-message" }, { status: 201 })
  })
  const response = await POST(
    new Request("https://shop.example.test/api/live/messages/customer-shop", {
      method: "POST",
      body: JSON.stringify({ body: "Xin chào" }),
      headers: {
        origin: "https://shop.example.test",
        "Content-Type": "application/json",
        "Idempotency-Key": "message-request-id",
        "X-Socket-ID": "123.456",
        Authorization: "Bearer injected-token",
      },
    }),
    context("messages", "customer-shop")
  )
  assert.equal(response.status, 201)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.deepEqual(await response.json(), { id: "stored-message" })
  assert.equal(upstream.mock.callCount(), 1)
})

test("product image preparation streams multipart data to the authenticated private Laravel route", async (t) => {
  globalThis.__liveTransportTest.token = "private-cookie-token"
  const image = new File(["RIFF0000WEBP"], "prepared.webp", {
    type: "image/webp",
  })
  const payload = new FormData()
  payload.set("token", "owner-bound-staged-upload-token")
  payload.set("image", image)
  const upstream = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(
      url,
      "https://api.example.test/api/private/uploads/images/prepare"
    )
    assert.equal(options.method, "POST")
    assert.equal(
      options.headers.get("Authorization"),
      "Bearer private-cookie-token"
    )
    assert.match(
      options.headers.get("Content-Type"),
      /^multipart\/form-data; boundary=/
    )
    assert.equal(options.headers.get("Cookie"), null)
    assert.ok(options.body instanceof ReadableStream)
    assert.equal(options.duplex, "half")
    const multipart = await new Response(options.body, {
      headers: options.headers,
    }).formData()
    assert.deepEqual(Array.from(multipart.keys()), ["token", "image"])
    assert.equal(multipart.get("token"), "owner-bound-staged-upload-token")
    const uploaded = multipart.get("image")
    assert.equal(uploaded.name, "prepared.webp")
    assert.equal(uploaded.type, "image/webp")
    assert.equal(await uploaded.text(), await image.text())
    return new Response(null, { status: 204 })
  })
  const response = await POST(
    new Request("https://shop.example.test/api/live/uploads/images/prepare", {
      method: "POST",
      headers: {
        origin: "https://shop.example.test",
        Authorization: "Bearer forged-browser-token",
      },
      body: payload,
    }),
    context("uploads", "images", "prepare")
  )
  assert.equal(response.status, 204)
  assert.equal(await response.text(), "")
  assert.equal(upstream.mock.callCount(), 1)

  const disallowedMethod = await GET(
    new Request("https://shop.example.test/api/live/uploads/images/prepare"),
    context("uploads", "images", "prepare")
  )
  assert.equal(disallowedMethod.status, 404)
  assert.equal(upstream.mock.callCount(), 1)
})

test("background synchronization does not block a chat send in the browser", async (t) => {
  const pending = []
  t.mock.method(
    globalThis,
    "fetch",
    (url, options) =>
      new Promise((resolve) => pending.push({ url, options, resolve }))
  )
  const counts = liveApiFetch("/auth/me")
  const heartbeat = liveApiFetch("/presence/heartbeat", {
    method: "POST",
    body: {},
  })
  const send = liveApiFetch("/messages/customer-shop", {
    method: "POST",
    body: { body: "Hello" },
  })
  assert.equal(pending.length, 3)
  assert.deepEqual(
    pending.map(({ url }) => url),
    [
      "/api/live/auth/me",
      "/api/live/presence/heartbeat",
      "/api/live/messages/customer-shop",
    ]
  )
  assert.ok(
    pending.every(
      ({ options }) =>
        options.credentials === "same-origin" &&
        !options.headers.has("Authorization")
    )
  )
  pending[2].resolve(Response.json({ id: "sent" }))
  assert.deepEqual(await send, { id: "sent" })
  pending[0].resolve(Response.json({ count: 1 }))
  pending[1].resolve(Response.json({ ok: true }))
  await Promise.all([counts, heartbeat])
})

test("upstream failure returns a retryable response without leaking credentials", async (t) => {
  globalThis.__liveTransportTest.token = "private-cookie-token"
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Connection error with private-cookie-token")
  })
  const response = await GET(
    new Request("https://shop.example.test/api/live/notifications"),
    context("notifications")
  )
  assert.equal(response.status, 503)
  assert.doesNotMatch(await response.text(), /private-cookie-token/)
})
