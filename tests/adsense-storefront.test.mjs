import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import test from "node:test"
import ts from "typescript"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`

function transpile(path, imports = {}) {
  const { outputText } = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  })
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
const { setPathname } = await import(navigationUrl)
const {
  ADSENSE_PUBLISHER_ID,
  ADSENSE_CLIENT_ID,
  ADSENSE_SCRIPT_URL,
  isStorefrontAdvertisingPath,
} = await import(configUrl)
const { StorefrontAdvertising } = await import(
  transpile("../src/components/storefront-advertising.tsx", {
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "next/navigation": navigationUrl,
    "@/config/advertising": configUrl,
  })
)

test("loads one async AdSense script for the authorized publisher without an ad link or banner", () => {
  setPathname("/")
  assert.equal(ADSENSE_PUBLISHER_ID, "pub-8299349376566920")
  assert.equal(ADSENSE_CLIENT_ID, `ca-${ADSENSE_PUBLISHER_ID}`)
  assert.equal(
    ADSENSE_SCRIPT_URL,
    `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`
  )
  const script = StorefrontAdvertising()
  assert.equal(script.type, "script")
  assert.equal(script.props.id, "google-adsense")
  assert.equal(script.props.src, ADSENSE_SCRIPT_URL)
  assert.equal(script.props.async, true)
  assert.equal(script.props.crossOrigin, "anonymous")
  assert.equal(script.props.children, undefined)
  assert.equal(script.props.onClick, undefined)
})

test("React hoists the async script into the head and deduplicates repeated instances", () => {
  setPathname("/")
  const html = renderToStaticMarkup(
    createElement(
      "html",
      null,
      createElement("head"),
      createElement(
        "body",
        null,
        createElement("main", null, "Sản phẩm"),
        createElement(StorefrontAdvertising),
        createElement(StorefrontAdvertising)
      )
    )
  )
  assert.equal((html.match(/<script\b/g) || []).length, 1)
  const head = html.match(/<head>(.*?)<\/head>/s)?.[1]
  assert.ok(head?.includes(ADSENSE_SCRIPT_URL))
  assert.match(head, /<script\b[^>]*\basync=""/)
  assert.match(head, /crossorigin="anonymous"/i)
  const body = html.match(/<body>(.*?)<\/body>/s)?.[1]
  assert.equal(body, "<main>Sản phẩm</main>")
})

test("initializes advertising only on home, shop and product pages", () => {
  const allowed = [
    "/",
    "/shops/SHPOW-123",
    "/shops/SHPOW-123/",
    "/shops/SHPOW-123/products/shirt",
    "/shops/SHPOW-123/products/shirt/",
  ]
  const excluded = [
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
  ]
  for (const pathname of allowed) {
    setPathname(pathname)
    assert.equal(isStorefrontAdvertisingPath(pathname), true, pathname)
    assert.equal(
      StorefrontAdvertising().props.src,
      ADSENSE_SCRIPT_URL,
      pathname
    )
  }
  for (const pathname of excluded) {
    setPathname(pathname)
    assert.equal(isStorefrontAdvertisingPath(pathname), false, String(pathname))
    assert.equal(StorefrontAdvertising(), null, String(pathname))
  }
})

test("publisher metadata and ads.txt authorize the same sole Google account", () => {
  const layout = read("../src/app/layout.tsx")
  assert.match(layout, /<StorefrontAdvertising\s*\/>/)
  assert.match(layout, /["']google-adsense-account["']:\s*ADSENSE_CLIENT_ID/)
  assert.equal(
    read("../public/ads.txt").trim(),
    `google.com, ${ADSENSE_PUBLISHER_ID}, DIRECT, f08c47fec0942fa0`
  )
})

test("removes the previous provider and discloses Google advertising privacy", () => {
  for (const path of [
    "../src/config/advertising.ts",
    "../src/components/storefront-advertising.tsx",
    "../src/app/layout.tsx",
    "../src/app/privacy/page.tsx",
    "../src/app/terms/page.tsx",
  ]) {
    assert.doesNotMatch(read(path), /adsterra|profitableratecpmnetwork/i, path)
  }
  const privacy = read("../src/app/privacy/page.tsx")
  assert.match(privacy, /Google AdSense/)
  assert.match(privacy, /https:\/\/policies\.google\.com\//)
  assert.match(privacy, /https:\/\/myadcenter\.google\.com\//)
  assert.equal(
    existsSync(new URL("../src/app/ads/adsterra/route.ts", import.meta.url)),
    false
  )
})
