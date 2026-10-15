import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { Children } from "react"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(path, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
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
const configUrl = transpile("../src/config/advertising.ts")
const navigationUrl = moduleUrl(`
  let pathname = "/"
  export function setPathname(value) { pathname = value }
  export function usePathname() { return pathname }
`)
const scriptUrl = moduleUrl("export default function Script() {}")
const { setPathname } = await import(navigationUrl)
const { ADSTERRA_SMARTLINK_URL, isStorefrontAdvertisingPath } = await import(
  configUrl
)
const { StorefrontAdvertising } = await import(
  transpile("../src/components/storefront-advertising.tsx", {
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "next/navigation": navigationUrl,
    "next/script": scriptUrl,
    "@/config/advertising": configUrl,
  })
)

test("loads both supplied Adsterra website tags on the storefront", () => {
  setPathname("/")
  const children = Children.toArray(StorefrontAdvertising().props.children)
  const scripts = children.filter((child) => child.props.src)
  assert.deepEqual(
    scripts.map((script) => script.props.src),
    [
      "https://pl31851231.profitableratecpmnetwork.com/d1/ef/34/d1ef34f7547431dda803fb4f5849055c.js",
      "https://pl31851232.profitableratecpmnetwork.com/6d/2d/55/6d2d5564c18455acfe7ff77b2d908f42.js",
    ]
  )
  assert.deepEqual(
    scripts.map((script) => script.props.id),
    ["adsterra-website-1", "adsterra-website-2"]
  )
  for (const script of scripts) {
    assert.equal(script.props.strategy, "afterInteractive")
  }
})

test("the latest SmartLink is a labeled, ordinary sponsored link separate from ordering", () => {
  setPathname("/")
  const [placement] = Children.toArray(StorefrontAdvertising().props.children)
  assert.equal(placement.type, "aside")
  assert.equal(placement.props["aria-label"], "Quảng cáo đối tác")
  const link = Children.toArray(placement.props.children).find(
    (child) => child.type === "a"
  )
  assert.equal(
    ADSTERRA_SMARTLINK_URL,
    "https://www.profitableratecpmnetwork.com/kyeauguj?key=0c9c015392eee094b68685f873d92dac"
  )
  assert.equal(link.props.href, ADSTERRA_SMARTLINK_URL)
  assert.equal(link.props.target, "_blank")
  assert.equal(link.props.rel, "noopener noreferrer sponsored")
  assert.equal(link.props.children, "Xem quảng cáo Adsterra")
  assert.equal(link.props.onClick, undefined)
})

test("enables ads on home, shop and product pages", () => {
  for (const pathname of [
    "/",
    "/shops/SHPOW-123",
    "/shops/SHPOW-123/",
    "/shops/SHPOW-123/products/shirt",
    "/shops/SHPOW-123/products/shirt/",
  ]) {
    setPathname(pathname)
    assert.equal(isStorefrontAdvertisingPath(pathname), true, pathname)
    assert.notEqual(StorefrontAdvertising(), null, pathname)
  }
})

test("does not initialize website ads on private, admin, auth, wallet or checkout routes", () => {
  for (const pathname of [
    null,
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/profile",
    "/notifications",
    "/chats",
    "/chats/private-thread",
    "/admin",
    "/admin/shops",
    "/shop-manage",
    "/sell",
    "/discount-codes",
    "/checkout",
    "/terms",
    "/privacy",
    "/api/shops",
    "/shops/a/products/b/orders",
    "/shops/a/checkout",
  ]) {
    setPathname(pathname)
    assert.equal(isStorefrontAdvertisingPath(pathname), false, String(pathname))
    assert.equal(StorefrontAdvertising(), null, String(pathname))
  }
})

test("SPA return navigation keeps the same script identities for Next Script deduplication", () => {
  const scriptIdentities = (pathname) => {
    setPathname(pathname)
    return Children.toArray(StorefrontAdvertising().props.children)
      .filter((child) => child.props.src)
      .map((child) => ({ id: child.props.id, src: child.props.src }))
  }
  const initial = scriptIdentities("/")
  setPathname("/profile")
  assert.equal(StorefrontAdvertising(), null)
  assert.deepEqual(scriptIdentities("/shops/SHPOW-123"), initial)
  assert.deepEqual(scriptIdentities("/shops/SHPOW-123/products/shirt"), initial)
})

test("ordinary advertising has no reward actions, timers or orphan ad landing page", () => {
  const source = readFileSync(
    new URL("../src/components/storefront-advertising.tsx", import.meta.url),
    "utf8"
  )
  assert.doesNotMatch(
    source,
    /startProductAdvertisementAction|completeProductAdvertisementAction|\/complete|discount-code|setTimeout|setInterval|onEnded|onLoad|onReady|0đ/
  )
  assert.equal(
    existsSync(new URL("../src/app/ads/adsterra/route.ts", import.meta.url)),
    false
  )
})
