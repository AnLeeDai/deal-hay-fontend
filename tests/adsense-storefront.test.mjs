import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")

test("the app layout uses ordinary Adsterra ads without Google advertising metadata", () => {
  const source = read("../src/app/layout.tsx")
  assert.match(source, /<StorefrontAdvertising\s*\/>/)
  assert.doesNotMatch(
    source,
    /StorefrontAdsense|ADSENSE|google-adsense-account/
  )
})

test("the old Google ad loader, config and publisher authorization are removed", () => {
  for (const path of [
    "../src/components/storefront-adsense.tsx",
    "../src/config/adsense.ts",
    "../public/ads.txt",
  ]) {
    assert.equal(existsSync(new URL(path, import.meta.url)), false, path)
  }
})

test("advertising configuration and integration contain no Google advertising requests", () => {
  for (const path of [
    "../src/components/storefront-advertising.tsx",
    "../src/config/advertising.ts",
    "../src/app/layout.tsx",
    "../src/app/privacy/page.tsx",
    "../src/app/terms/page.tsx",
  ]) {
    assert.doesNotMatch(
      read(path),
      /adsbygoogle|googlesyndication|doubleclick|ca-pub-|pub-7303400269186048|AdSense/i,
      path
    )
  }
})

test("the privacy policy describes the active Adsterra integration", () => {
  const source = read("../src/app/privacy/page.tsx")
  assert.match(source, /Adsterra/)
  assert.match(source, /https:\/\/adsterra\.com\/privacy-policy\//)
  assert.doesNotMatch(source, /policies\.google\.com|myadcenter\.google\.com/)
})
