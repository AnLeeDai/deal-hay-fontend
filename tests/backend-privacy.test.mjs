import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function compile(file, imports = {}) {
  return ts
    .transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    })
    .outputText.replace(/import ["']server-only["'];?\s*/g, "")
    .replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
      assert.ok(imports[name], `Unexpected import ${name}`)
      return `from ${quote}${imports[name]}${quote}`
    })
}
const backend = "https://private-api.example.test/api"
const envUrl = moduleUrl(`export const env = { BACKEND_API_URL: "${backend}" }`)
const privacyUrl = moduleUrl(
  compile("../src/lib/backend-privacy.ts", { "@/config/env": envUrl })
)
const { sanitizeBackendPayload, safePublicMediaPath, privateJsonResponse } =
  await import(privacyUrl)
const { GET: getAsset } = await import(
  moduleUrl(
    compile("../src/app/api/media/assets/[...path]/route.ts", {
      "@/config/env": envUrl,
      "@/lib/backend-privacy": privacyUrl,
    })
  )
)
const cookieUrl = moduleUrl(
  `export async function cookies() { return { get() { return { value: "server-cookie-token" } } } }`
)
const { apiFetch, ApiError } = await import(
  moduleUrl(
    compile("../src/api/client.ts", {
      "next/headers": cookieUrl,
      "@/config/env": envUrl,
      "@/lib/backend-privacy": privacyUrl,
      "@/lib/cookies": moduleUrl(
        `export const AUTH_TOKEN_COOKIE = "auth-token"`
      ),
    })
  )
)
const context = (...path) => ({ params: Promise.resolve({ path }) })
const assetRequest = () =>
  new Request("https://shop.example.test/api/media/assets/owner/photo.webp", {
    headers: { Cookie: "sensitive-cookie", Authorization: "Bearer injected" },
  })

test("server payloads replace backend media, attachment, pagination and embedded error URLs before serialization", () => {
  const input = {
    user: { avatar_url: `${backend}/media/assets/owner/avatar.webp` },
    messages: [
      {
        attachment: { url: `${backend}/messages/attachments/message-id` },
        body: `Cannot fetch ${backend}/private/products?status=1`,
      },
    ],
    links: [{ url: `${backend}/notifications?page=2` }],
    external: "https://other.example.test/image.webp",
    storage: "https://private-api.example.test/storage/r2/owner/product.webp",
    value: 0,
    empty: null,
  }
  const output = sanitizeBackendPayload(input)
  assert.equal(output.user.avatar_url, "/api/media/assets/owner/avatar.webp")
  assert.equal(
    output.messages[0].attachment.url,
    "/api/chat-attachments/message-id"
  )
  assert.equal(
    output.messages[0].body,
    "Cannot fetch /api/private/products?status=1"
  )
  assert.equal(output.links[0].url, "/api/notifications?page=2")
  assert.equal(output.external, input.external)
  assert.equal(output.storage, "/api/media/assets/owner/product.webp")
  assert.equal(
    input.user.avatar_url,
    `${backend}/media/assets/owner/avatar.webp`
  )
  assert.doesNotMatch(JSON.stringify(output), /private-api\.example\.test/)
  assert.equal(
    sanitizeBackendPayload("Cannot resolve private-api.example.test"),
    "Cannot resolve DealHay Backend"
  )
  assert.equal(
    sanitizeBackendPayload({
      broadcaster: "reverb",
      host: "socket.example.test",
    }).host,
    "socket.example.test"
  )
})

test("public asset transport accepts safe keys and rejects URL traversal and private namespaces without a fetch", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw Error("Must not fetch")
  })
  for (const path of [
    ["..", "secret"],
    ["owner", "%2e%2e", "image.webp"],
    ["https:", "evil.test"],
    ["chat-media", "private.webp"],
    ["staged-images", "private.webp"],
    ["owner", "file?target=evil"],
    ["owner", "file\\secret"],
    ["", "file.webp"],
  ]) {
    assert.equal(safePublicMediaPath(path), null)
    const response = await getAsset(assetRequest(), context(...path))
    assert.equal(response.status, 404)
  }
  assert.equal(fetch.mock.callCount(), 0)
  assert.equal(
    safePublicMediaPath(["systems_avatar", "systems_users_AV1.webp"]),
    "systems_avatar/systems_users_AV1.webp"
  )
})

test("public images stream byte-for-byte through only the configured backend with no browser credentials or redirect headers", async (t) => {
  const bytes = new Uint8Array([82, 73, 70, 70, 0, 1, 2, 3])
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, `${backend}/media/assets/owner/photo.webp`)
    assert.equal(options.redirect, "error")
    const headers = new Headers(options.headers)
    assert.equal(headers.get("X-DealHay-Media-Transport"), "stream")
    assert.equal(headers.get("Cookie"), null)
    assert.equal(headers.get("Authorization"), null)
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.length),
        Location: `${backend}/secret`,
        "Set-Cookie": "private",
      },
    })
  })
  const response = await getAsset(
    assetRequest(),
    context("owner", "photo.webp")
  )
  assert.equal(response.status, 200)
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
  assert.equal(response.headers.get("Location"), null)
  assert.equal(response.headers.get("Set-Cookie"), null)
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff")
  assert.match(response.headers.get("Cache-Control"), /public/)
  assert.match(response.headers.get("Cache-Control"), /s-maxage=86400/)
})

test("asset errors unknown MIME missing size and oversized objects return no internal payload", async (t) => {
  const responses = [
    new Response("private backend error", { status: 500 }),
    new Response("<svg/>", {
      headers: { "Content-Type": "image/svg+xml", "Content-Length": "6" },
    }),
    new Response("image", { headers: { "Content-Type": "image/webp" } }),
    new Response("image", {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(3 * 1024 * 1024 + 1),
      },
    }),
  ]
  t.mock.method(globalThis, "fetch", async () => responses.shift())
  for (let index = 0; index < 4; index++) {
    const response = await getAsset(
      assetRequest(),
      context("owner", "photo.webp")
    )
    assert.equal(response.status, 502)
    assert.equal(await response.text(), "")
  }
})

test("asset byte limits reject a stream larger or shorter than its declared size", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(new Uint8Array([1, 2]), {
        headers: { "Content-Type": "image/webp", "Content-Length": "1" },
      })
  )
  const response = await getAsset(
    assetRequest(),
    context("owner", "photo.webp")
  )
  await assert.rejects(response.arrayBuffer(), /Image too large/)
})

test("API reads and ApiError payloads are sanitized before use by Server Components and actions", async (t) => {
  let success = true
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, `${backend}/profile`)
    assert.equal(
      options.headers.get("Authorization"),
      "Bearer server-cookie-token"
    )
    assert.equal(options.redirect, "error")
    return success
      ? Response.json({ image_url: `${backend}/media/assets/a/b.webp` })
      : Response.json(
          {
            message: `Failure at ${backend}/private`,
            errors: { image: [`Rejected ${backend}/media/assets/a/b.webp`] },
          },
          { status: 422 }
        )
  })
  assert.deepEqual(await apiFetch({ path: "/profile" }), {
    image_url: "/api/media/assets/a/b.webp",
  })
  success = false
  await assert.rejects(apiFetch({ path: "/profile" }), (error) => {
    assert.ok(error instanceof ApiError)
    assert.doesNotMatch(
      error.message + JSON.stringify(error.payload),
      /private-api\.example\.test/
    )
    return true
  })
})

test("live JSON transport sanitizes nested responses and replaces non-JSON/oversized upstream errors", async () => {
  const response = await privateJsonResponse(
    Response.json({ user: { avatar_url: `${backend}/media/assets/a/b.webp` } })
  )
  assert.doesNotMatch(await response.text(), /private-api\.example\.test/)
  for (const upstream of [
    new Response(`<html>${backend}</html>`),
    new Response('"' + "x".repeat(4 * 1024 * 1024) + '"', {
      headers: { "Content-Type": "application/json" },
    }),
  ]) {
    const rejected = await privateJsonResponse(upstream)
    assert.equal(rejected.status, 502)
    assert.doesNotMatch(await rejected.text(), /private-api\.example\.test/)
  }
})

test("private backend env takes precedence and legacy fallback stays server-only", async () => {
  const oldPrivate = process.env.BACKEND_API_URL
  const oldLegacy = process.env.NEXT_PUBLIC_API
  try {
    const source = compile("../src/config/env.ts", {
      zod: import.meta.resolve("zod"),
    })
    process.env.BACKEND_API_URL = " https://internal.example.test/api/ "
    process.env.NEXT_PUBLIC_API = "https://legacy.example.test/api"
    const first = await import(moduleUrl(source + "\n// private"))
    assert.equal(first.env.BACKEND_API_URL, "https://internal.example.test/api")
    assert.equal(first.env.NEXT_PUBLIC_API, undefined)
    delete process.env.BACKEND_API_URL
    const second = await import(moduleUrl(source + "\n// fallback"))
    assert.equal(second.env.BACKEND_API_URL, "https://legacy.example.test/api")
  } finally {
    if (oldPrivate === undefined) delete process.env.BACKEND_API_URL
    else process.env.BACKEND_API_URL = oldPrivate
    if (oldLegacy === undefined) delete process.env.NEXT_PUBLIC_API
    else process.env.NEXT_PUBLIC_API = oldLegacy
  }
})
