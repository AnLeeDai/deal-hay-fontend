import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
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
const { GET } = await import(
  transpile("../src/app/ads/adsterra/route.ts", {
    "@/config/advertising": configUrl,
  })
)

test("Adsterra page includes the supplied website tags and the latest SmartLink", async () => {
  const response = GET()
  const html = await response.text()
  assert.equal(response.status, 200)
  assert.match(
    response.headers.get("content-type"),
    /text\/html; charset=utf-8/
  )
  assert.ok(
    html.includes(
      'src="https://pl31851231.profitableratecpmnetwork.com/d1/ef/34/d1ef34f7547431dda803fb4f5849055c.js"'
    )
  )
  assert.ok(
    html.includes(
      'src="https://pl31851232.profitableratecpmnetwork.com/6d/2d/55/6d2d5564c18455acfe7ff77b2d908f42.js"'
    )
  )
  assert.ok(
    html.includes(
      'href="https://www.profitableratecpmnetwork.com/kyeauguj?key=0c9c015392eee094b68685f873d92dac"'
    )
  )
  assert.equal((html.match(/<script /g) ?? []).length, 2)
  assert.ok(html.includes('rel="noopener noreferrer sponsored"'))
})

test("opening an ordinary Adsterra advertisement never calls coupon APIs or promises completion", async () => {
  const html = await GET().text()
  assert.ok(
    html.includes("Việc mở, chờ hoặc đóng trang quảng cáo không cấp mã.")
  )
  assert.ok(!html.includes("/complete"))
  assert.ok(!html.includes("/discount-codes"))
  assert.ok(!html.includes("setTimeout"))
  assert.ok(!html.includes("adsbygoogle"))
  assert.equal(GET().headers.get("cross-origin-opener-policy"), "same-origin")
})
