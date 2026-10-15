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

const validationUrl = transpileModule("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const schemaUrl = transpileModule("../src/modules/auth/schemas/auth.ts", {
  "@/lib/validation": validationUrl,
  zod: import.meta.resolve("zod"),
})
const apiUrl = moduleUrl(`
  export class ApiError extends Error {
    constructor(status, payload) {
      super(payload.message)
      this.status = status
      this.errors = payload.errors
    }
  }
  export const state = {
    error: undefined,
    payload: undefined,
    calls: [],
    cookies: [],
    revalidated: [],
  }
  export async function login(payload) {
    state.calls.push(payload)
    if (state.error) throw state.error
    return state.payload
  }
  export async function setAuthCookies(payload) { state.cookies.push(payload) }
  export function revalidatePath(path) { state.revalidated.push(path) }
  export class Redirect extends Error {
    constructor(destination) {
      super("NEXT_REDIRECT")
      this.destination = destination
    }
  }
  export function redirect(destination) { throw new Redirect(destination) }
  export function clearAuthCookies() { throw new Error("Unexpected logout") }
  export function forgotPassword() { throw new Error("Unexpected password reset") }
  export function resetPassword() { throw new Error("Unexpected password reset") }
  export function logout() { throw new Error("Unexpected logout") }
  export function register() { throw new Error("Unexpected registration") }
`)
const redirectUrl = transpileModule("../src/lib/auth-redirect.ts")
const { signInAction } = await import(
  transpileModule("../src/modules/auth/actions.ts", {
    "next/cache": apiUrl,
    "next/navigation": apiUrl,
    "@/api/client": apiUrl,
    "@/api/auth/mutations": apiUrl,
    "@/lib/auth": apiUrl,
    "@/lib/auth-redirect": redirectUrl,
    "@/modules/auth/schemas/auth": schemaUrl,
  })
)
const { ApiError, Redirect, state } = await import(apiUrl)

const credentials = {
  email: "person@example.com",
  password: "CorrectPassword!1",
  admin_verification_code: "",
}

test.beforeEach(() => {
  state.error = undefined
  state.payload = {
    message: "Đăng nhập thành công.",
    token: "test-token",
    user: { role: "customer" },
  }
  state.calls.length = 0
  state.cookies.length = 0
  state.revalidated.length = 0
})

test("an administrator challenge reveals verification without creating a session", async () => {
  const errors = {
    admin_verification_code: [
      "Mã xác minh đã được gửi đến email quản trị viên.",
    ],
  }
  state.error = new ApiError(422, { message: "Vui lòng nhập mã.", errors })

  const result = await signInAction(credentials)

  assert.equal(result.success, false)
  assert.equal(result.requiresAdminVerification, true)
  assert.deepEqual(result.errors, errors)
  assert.equal(state.calls[0].admin_verification_code, undefined)
  assert.equal(state.cookies.length, 0)
  assert.equal(state.revalidated.length, 0)
})

test("invalid credentials and unrelated failures do not reveal administrator verification", async () => {
  for (const [status, errors] of [
    [422, { email: ["Thông tin đăng nhập không chính xác."] }],
    [403, undefined],
    [500, { admin_verification_code: ["Unexpected server failure"] }],
  ]) {
    state.error = new ApiError(status, {
      message: "Đăng nhập thất bại.",
      errors,
    })

    const result = await signInAction(credentials)

    assert.equal(result.requiresAdminVerification, false)
    assert.equal(state.cookies.length, 0)
  }
})

test("malformed verification codes fail local validation without exposing an administrator challenge", async () => {
  const result = await signInAction({
    ...credentials,
    admin_verification_code: "123",
  })

  assert.equal(result.success, false)
  assert.notEqual(result.requiresAdminVerification, true)
  assert.ok(result.errors.admin_verification_code.length)
  assert.equal(state.calls.length, 0)
  assert.equal(state.cookies.length, 0)
})

test("an invalid or expired administrator code keeps verification available and creates no session", async () => {
  state.error = new ApiError(422, {
    message: "Mã xác minh không chính xác hoặc đã hết hạn.",
    errors: {
      admin_verification_code: ["Mã xác minh không chính xác hoặc đã hết hạn."],
    },
  })

  const result = await signInAction({
    ...credentials,
    admin_verification_code: "123456",
  })

  assert.equal(result.requiresAdminVerification, true)
  assert.equal(state.calls[0].admin_verification_code, "123456")
  assert.equal(state.cookies.length, 0)
})

test("a regular account signs in without supplying an administrator code", async () => {
  await assert.rejects(signInAction(credentials, "/chats"), (error) => {
    assert.ok(error instanceof Redirect)
    assert.equal(error.destination, "/chats")
    return true
  })

  assert.equal(state.calls[0].admin_verification_code, undefined)
  assert.deepEqual(state.cookies, [state.payload])
  assert.deepEqual(state.revalidated, ["/"])
})

test("a verified administrator receives a session and retains the safe return destination", async () => {
  state.payload.user.role = "administrator"

  await assert.rejects(
    signInAction(
      { ...credentials, admin_verification_code: "123456" },
      "/admin/users"
    ),
    (error) => {
      assert.ok(error instanceof Redirect)
      assert.equal(error.destination, "/admin/users")
      return true
    }
  )

  assert.equal(state.calls[0].admin_verification_code, "123456")
  assert.deepEqual(state.cookies, [state.payload])
})
