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
  export const state = { calls: [], authError: null, apiError: null, response: null }
  export class ApiError extends Error {
    constructor(status, payload) {
      super(payload.message)
      this.status = status
    }
  }
  export async function requireAuth(redirectTo) {
    state.calls.push({ auth: redirectTo })
    if (state.authError) throw state.authError
    return { role: 'customer' }
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
const { measureDiagnosticsAction } = await import(
  transpileModule("../src/modules/diagnostics/actions.ts", {
    "@/api/client": apiUrl,
    "@/api/diagnostics/queries": queriesUrl,
    "@/lib/auth": apiUrl,
  })
)
const { ApiError, state } = await import(apiUrl)

test.beforeEach(() => {
  state.calls.length = 0
  state.authError = null
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

test("signed-in customers receive fresh HTTP timing and the original service measurements", async () => {
  const result = await measureDiagnosticsAction()

  assert.deepEqual(state.calls, [
    { auth: "/diagnostics" },
    { path: "/diagnostics", cache: "no-store" },
  ])
  assert.equal(result.success, true)
  assert.equal(result.data.checked_at, state.response.checked_at)
  assert.equal(result.data.duration_ms, 18.5)
  assert.deepEqual(result.data.checks, state.response.checks)
  assert.ok(Number.isFinite(result.data.api_latency_ms))
  assert.ok(result.data.api_latency_ms >= 0)
})

test("authentication redirects are preserved and stop diagnostic requests", async () => {
  state.authError = new Error("NEXT_REDIRECT")

  await assert.rejects(measureDiagnosticsAction(), state.authError)
  assert.deepEqual(state.calls, [{ auth: "/diagnostics" }])
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
