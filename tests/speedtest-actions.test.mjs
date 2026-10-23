import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(path, imports) {
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
const mocks = moduleUrl(`
  export const state = { token: null, calls: [], response: null, error: null }
  export class ApiError extends Error { constructor(status, message) { super(message); this.status = status } }
  export async function cookies() { return { get(name) { state.calls.push({ cookie: name }); return state.token ? { value: state.token } : undefined } } }
  export function redirect(href) { const error = new Error('NEXT_REDIRECT'); error.href = href; throw error }
  export async function clearAuthCookies() { state.calls.push({ clearAuthCookies: true }); state.token = null }
  export async function apiFetch(options) { state.calls.push(options); if (state.error) throw state.error; return state.response }
  export const env = { NEXT_PUBLIC_API: 'https://api.example.test/api' }
`)
const { state, ApiError } = await import(mocks)
const { startSpeedtestAction } = await import(
  transpile("../src/modules/diagnostics/speedtest-actions.ts", {
    "next/headers": mocks,
    "next/navigation": mocks,
    "@/api/client": mocks,
    "@/config/env": mocks,
    "@/lib/auth": mocks,
    "@/lib/auth-redirect": transpile("../src/lib/auth-redirect.ts", {}),
    "@/lib/cookies": transpile("../src/lib/cookies.ts", {}),
    zod: import.meta.resolve("zod"),
  })
)
test.beforeEach(() => {
  state.token = "123|private-account-token"
  state.calls = []
  state.error = null
  state.response = {
    token: "g".repeat(64),
    expires_at: "2026-10-24T10:00:00+00:00",
    endpoint_path: "/diagnostics/speedtest",
    limits: {
      max_download_bytes: 4194304,
      max_upload_bytes: 2097152,
      max_session_bytes: 67108864,
      max_requests: 64,
    },
  }
})

test("exchanges the private account token for a scoped grant without a second profile request", async () => {
  const result = await startSpeedtestAction()
  assert.deepEqual(state.calls, [
    { cookie: "dealhay_access_token" },
    {
      method: "POST",
      path: "/diagnostics/speedtest/session",
      token: state.token,
    },
  ])
  assert.deepEqual(result, {
    success: true,
    data: {
      token: state.response.token,
      endpointUrl: "https://api.example.test/api/diagnostics/speedtest",
      expiresAt: state.response.expires_at,
      limits: state.response.limits,
    },
  })
  assert.ok(!JSON.stringify(result).includes(state.token))
})

test("guests redirect to sign-in and expired account tokens are cleared", async () => {
  state.token = null
  await assert.rejects(startSpeedtestAction(), {
    message: "NEXT_REDIRECT",
    href: "/sign-in?redirect=%2Fdiagnostics",
  })
  assert.equal(state.calls.length, 1)
  state.token = "expired"
  state.error = new ApiError(401, "private account failure")
  await assert.rejects(startSpeedtestAction(), {
    message: "NEXT_REDIRECT",
    href: "/sign-in?redirect=%2Fdiagnostics",
  })
  assert.equal(state.token, null)
  assert.deepEqual(state.calls.at(-1), { clearAuthCookies: true })
})

test("returns an actionable limit message and sanitizes other server failures", async () => {
  state.error = new ApiError(429, "internal limiter details")
  assert.match((await startSpeedtestAction()).message, /đợi một phút/)
  for (const status of [403, 500, 502]) {
    state.error = new ApiError(status, "private service secrets")
    assert.deepEqual(await startSpeedtestAction(), {
      success: false,
      message: "Không thể bắt đầu đo kết nối đến máy chủ. Vui lòng thử lại.",
    })
  }
})

test("rejects malformed grants, account tokens, and endpoints outside the fixed probe path", async () => {
  for (const mutation of [
    { token: state.token },
    { token: "invalid" },
    { expires_at: "tomorrow" },
    { endpoint_path: "https://untrusted.example.test/upload" },
    { endpoint_path: "/auth/me" },
    { limits: { ...state.response.limits, max_upload_bytes: -1 } },
  ]) {
    const original = state.response
    state.response = { ...original, ...mutation }
    const result = await startSpeedtestAction()
    assert.equal(result.success, false)
    assert.ok(!JSON.stringify(result).includes("private"))
    state.response = original
  }
})
