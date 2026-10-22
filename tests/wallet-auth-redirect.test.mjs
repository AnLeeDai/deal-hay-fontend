import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(relativePath, imports = {}) {
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
    outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, specifier) => {
      assert.ok(imports[specifier], `Unexpected import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}
const redirectsUrl = transpile("../src/lib/auth-redirect.ts")
const { getSafeAuthRedirect, getAuthPageHref } = await import(redirectsUrl)
const { proxy } = await import(
  transpile("../src/proxy.ts", {
    "@/lib/auth-redirect": redirectsUrl,
    "@/lib/cookies": moduleUrl(
      'export const AUTH_TOKEN_COOKIE="auth_token"; export const AUTH_ROLE_COOKIE="auth_role"'
    ),
    "next/server": moduleUrl(
      "export const NextResponse={redirect:(url)=>({status:307,url:String(url)}),next:()=>({status:200})}"
    ),
  })
)

function request(path, values = {}) {
  const url = new URL(path, "https://deal-hay.local")
  return {
    url: url.href,
    nextUrl: url,
    cookies: {
      get: (name) => (values[name] ? { value: values[name] } : undefined),
    },
  }
}

test("wallet and saved-product links survive authentication", () => {
  for (const path of [
    "/discount-codes",
    "/discount-codes?status=available",
    "/diagnostics",
    "/shops/SHOP-1/products/ao-thun?discount_code=DH-EXAMPLE",
    "/shops/SHOP-1/products/ao-thun/checkout?variant_id=red-small&discount_code=DH-A%26B",
  ]) {
    assert.equal(getSafeAuthRedirect(path), path)
    assert.equal(
      new URL(
        getAuthPageHref("/sign-in", path),
        "https://deal-hay.local"
      ).searchParams.get("redirect"),
      path
    )
  }
})

test("authenticated sign-in returns to checkout with the selected variant and coupon", () => {
  const path =
    "/shops/SHOP-1/products/ao-thun/checkout?variant_id=red-small&discount_code=DH-A%26B"
  const response = proxy(
    request(getAuthPageHref("/sign-in", path), {
      auth_token: "session",
      auth_role: "customer",
    })
  )
  assert.equal(response.status, 307)
  assert.equal(response.url, new URL(path, "https://deal-hay.local").href)
})

test("wallet access sends guests to sign-in with their destination", () => {
  const response = proxy(request("/discount-codes?status=available"))
  assert.equal(response.status, 307)
  const destination = new URL(response.url)
  assert.equal(destination.pathname, "/sign-in")
  assert.equal(
    destination.searchParams.get("redirect"),
    "/discount-codes?status=available"
  )
})

test("authenticated customers and administrators can open their wallet", () => {
  for (const role of ["customer", "shop_owner", "administrator"]) {
    assert.equal(
      proxy(
        request("/discount-codes", { auth_token: "session", auth_role: role })
      ).status,
      200
    )
  }
})

test("login redirects reject external and encoded unsafe wallet destinations", () => {
  for (const path of [
    "https://outside.example/discount-codes",
    "//outside.example/discount-codes",
    "/%2foutside.example/discount-codes",
    "/discount-codes%5coutside.example",
    "/discount-codes%0aLocation:outside",
    "/discount-codes-invalid",
  ]) {
    assert.equal(getSafeAuthRedirect(path), "/", path)
  }
})
