import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
}

function transpileModule(relativePath, imports) {
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

const apiUrl = moduleUrl(`
  export const state = { calls: [], cookieReads: [], token: null, apiError: null, response: null }
  export class ApiError extends Error {
    constructor(status, payload) {
      super(payload.message)
      this.status = status
    }
  }
  export async function cookies() {
    return { get(name) {
      state.cookieReads.push(name)
      const value = name === 'dealhay_access_token' ? state.token : 'administrator'
      return value ? { value } : undefined
    } }
  }
  export async function clearAuthCookies() {
    state.calls.push({ clearAuthCookies: true })
    state.token = null
  }
  export function redirect(href) {
    state.calls.push({ redirect: href })
    const error = new Error('NEXT_REDIRECT')
    error.href = href
    throw error
  }
  export async function apiFetch(options) {
    state.calls.push(options)
    if (state.apiError) throw state.apiError
    return state.response
  }
`)
const queriesUrl = transpileModule("../src/api/diagnostics/queries.ts", {
  "@/api/client": apiUrl,
})
const redirectsUrl = transpileModule("../src/lib/auth-redirect.ts", {})
const cookiesUrl = transpileModule("../src/lib/cookies.ts", {})
const { measureDiagnosticsAction } = await import(
  transpileModule("../src/modules/diagnostics/actions.ts", {
    "next/headers": apiUrl,
    "next/navigation": apiUrl,
    "@/api/client": apiUrl,
    "@/api/diagnostics/queries": queriesUrl,
    "@/lib/auth": apiUrl,
    "@/lib/auth-redirect": redirectsUrl,
    "@/lib/cookies": cookiesUrl,
  })
)
const { ApiError, state } = await import(apiUrl)

test.beforeEach(() => {
  state.calls.length = 0
  state.cookieReads.length = 0
  state.token = "customer-session-token"
  state.apiError = null
  state.response = {
    checked_at: "2026-10-23T06:00:00Z",
    duration_ms: 18.5,
    checks: {
      database: {
        status: "ok",
        latency_ms: 3.5,
        message: "Kết nối thành công.",
      },
      cache: { status: "ok", latency_ms: 2, message: "Kết nối thành công." },
      storage: {
        status: "skipped",
        latency_ms: null,
        message: "Chưa cấu hình.",
      },
      reverb: {
        status: "failed",
        latency_ms: 10,
        message: "Không thể kết nối.",
      },
    },
  }
})

test("diagnostics makes one authenticated API request without fetching the profile", async () => {
  const result = await measureDiagnosticsAction()

  assert.deepEqual(state.calls, [
    {
      path: "/diagnostics",
      cache: "no-store",
      token: "customer-session-token",
    },
  ])
  assert.deepEqual(state.cookieReads, ["dealhay_access_token"])
  assert.equal(result.success, true)
  assert.equal(result.data.checked_at, state.response.checked_at)
  assert.equal(result.data.duration_ms, 18.5)
  assert.deepEqual(result.data.checks, state.response.checks)
  assert.ok(Number.isFinite(result.data.api_latency_ms))
  assert.ok(result.data.api_latency_ms >= 0)
})

test("fresh API request timing is preserved independently of a cached probe sample", async () => {
  state.response.request = {
    duration_ms: 8.5,
    database_queries: 3,
    database_ms: 5.25,
    probes_cached: true,
    limiter_store: "file",
  }

  const result = await measureDiagnosticsAction()

  assert.equal(result.success, true)
  assert.equal(result.data.duration_ms, 18.5)
  assert.deepEqual(result.data.request, state.response.request)
})

test("missing tokens redirect to sign-in without trusting role cookies or calling the API", async () => {
  state.token = null

  await assert.rejects(measureDiagnosticsAction(), {
    message: "NEXT_REDIRECT",
    href: "/sign-in?redirect=%2Fdiagnostics",
  })
  assert.deepEqual(state.cookieReads, ["dealhay_access_token"])
  assert.deepEqual(state.calls, [
    { redirect: "/sign-in?redirect=%2Fdiagnostics" },
  ])
})

test("API authentication remains authoritative and expired cookies are cleared before redirect", async () => {
  state.apiError = new ApiError(401, { message: "Unauthenticated." })

  await assert.rejects(measureDiagnosticsAction(), {
    message: "NEXT_REDIRECT",
    href: "/sign-in?redirect=%2Fdiagnostics",
  })
  assert.deepEqual(state.calls, [
    {
      path: "/diagnostics",
      cache: "no-store",
      token: "customer-session-token",
    },
    { clearAuthCookies: true },
    { redirect: "/sign-in?redirect=%2Fdiagnostics" },
  ])
  assert.equal(state.token, null)
})

test("forbidden accounts receive a sanitized failure without a login loop", async () => {
  state.apiError = new ApiError(403, {
    message: "Account is locked; private security reason.",
  })

  assert.deepEqual(await measureDiagnosticsAction(), {
    success: false,
    message: "Không thể đo độ trễ hệ thống. Vui lòng thử lại sau.",
  })
  assert.equal(state.calls.length, 1)
  assert.equal(state.token, "customer-session-token")
})

test("rate limiting returns an actionable retry message", async () => {
  state.apiError = new ApiError(429, { message: "Too many requests." })

  assert.deepEqual(await measureDiagnosticsAction(), {
    success: false,
    message: "Bạn đang đo quá thường xuyên. Vui lòng đợi một phút rồi thử lại.",
  })
})

test("API failures do not expose internal service details", async () => {
  state.apiError = new ApiError(500, {
    message: "Database secret at private.internal",
  })

  assert.deepEqual(await measureDiagnosticsAction(), {
    success: false,
    message: "Không thể đo độ trễ hệ thống. Vui lòng thử lại sau.",
  })
})
