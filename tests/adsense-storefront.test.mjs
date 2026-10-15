import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

function transpileModule(relativePath, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  )
  const source = outputText.replace(
    /from (["'])([^"']+)\1/g,
    (match, quote, specifier) => {
      assert.ok(imports[specifier], `Unmocked import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    }
  )
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
}

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
}

const configUrl = transpileModule("../src/config/adsense.ts")
const { ADSENSE_CLIENT_ID, ADSENSE_SCRIPT_URL, isAdSenseStorefrontPath } =
  await import(configUrl)
const navigationUrl = moduleUrl(`
  let pathname = "/"
  export function setPathname(value) { pathname = value }
  export function usePathname() { return pathname }
`)
const scriptUrl = moduleUrl("export default function Script() {}")
const { setPathname } = await import(navigationUrl)
const { StorefrontAdsense } = await import(
  transpileModule("../src/components/storefront-adsense.tsx", {
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "next/navigation": navigationUrl,
    "next/script": scriptUrl,
    "@/config/adsense": configUrl,
  })
)

test("uses the supplied Google publisher loader with asynchronous Next Script attributes", () => {
  setPathname("/")
  const script = StorefrontAdsense()

  assert.equal(ADSENSE_CLIENT_ID, "ca-pub-7303400269186048")
  assert.equal(
    ADSENSE_SCRIPT_URL,
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7303400269186048"
  )
  assert.equal(script.props.src, ADSENSE_SCRIPT_URL)
  assert.equal(script.props.id, "google-adsense")
  assert.equal(script.props.async, true)
  assert.equal(script.props.crossOrigin, "anonymous")
  assert.equal(script.props.strategy, "afterInteractive")
})

test("allows the home page and public shop/product routes", () => {
  for (const pathname of [
    "/",
    "/shops/SHPOW-123",
    "/shops/SHPOW-123/",
    "/shops/SHPOW-123/products/shirt",
    "/shops/SHPOW-123/products/shirt/",
  ]) {
    setPathname(pathname)
    assert.equal(isAdSenseStorefrontPath(pathname), true, pathname)
    assert.notEqual(StorefrontAdsense(), null, pathname)
  }
})

test("does not load AdSense on account, admin, chat, wallet or checkout routes", () => {
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
    assert.equal(isAdSenseStorefrontPath(pathname), false, String(pathname))
    assert.equal(StorefrontAdsense(), null, String(pathname))
  }
})

test("authorizes the same supplied publisher in root ads.txt", () => {
  assert.equal(
    readFileSync(new URL("../public/ads.txt", import.meta.url), "utf8").trim(),
    "google.com, pub-7303400269186048, DIRECT, f08c47fec0942fa0"
  )
})
