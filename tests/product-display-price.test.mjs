import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
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
        jsx: ts.JsxEmit.ReactJSX,
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

const uiUrl = moduleUrl(`
  import { createElement } from ${JSON.stringify(import.meta.resolve("react"))}
  const wrapper = ({ children }) => createElement("div", null, children)
  export default wrapper
  export const Badge = wrapper
  export const Card = wrapper
  export const CardContent = wrapper
  export const CardFooter = wrapper
  export const MediaImage = () => null
  export const ArrowUpRightIcon = () => null
  export const PackageCheckIcon = () => null
`)
const formatUrl = transpileModule("../src/lib/format.ts")
const { formatCurrency } = await import(formatUrl)
const { ProductCard } = await import(
  transpileModule("../src/modules/public/components/product-card.tsx", {
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "next/link": uiUrl,
    "lucide-react": uiUrl,
    "@/components/media-image": uiUrl,
    "@/components/ui/badge": uiUrl,
    "@/components/ui/card": uiUrl,
    "@/lib/format": formatUrl,
  })
)

function renderCard(prices) {
  return renderToStaticMarkup(
    createElement(ProductCard, {
      href: "/shops/test-shop/products/test-product",
      product: {
        id: "product-1",
        name: "Variant product",
        category: "Test category",
        stock: 2,
        price: 50000,
        has_variants: true,
        ...prices,
      },
    })
  )
}

test("catalog cards show the initial variant price instead of the base price", () => {
  const rendered = renderCard({ display_price: 80000 })

  assert.ok(rendered.includes(formatCurrency(80000)))
  assert.ok(!rendered.includes(formatCurrency(50000)))
})

test("a zero-priced variant does not fall back to the base price", () => {
  const rendered = renderCard({ display_price: 0 })

  assert.ok(rendered.includes(formatCurrency(0)))
  assert.ok(!rendered.includes(formatCurrency(50000)))
})

test("older API responses and simple products retain their base price", () => {
  assert.ok(renderCard({}).includes(formatCurrency(50000)))
})

test("an available ad offer shows the regular price, sale price, percentage, and condition", () => {
  const rendered = renderCard({
    display_price: 80000,
    display_original_price: 100000,
    advertisement_available: true,
  })
  assert.ok(rendered.includes(formatCurrency(100000)))
  assert.ok(rendered.includes(formatCurrency(80000)))
  assert.ok(rendered.includes("20"))
  assert.ok(rendered.includes("Giá sau khi xem quảng cáo"))
  assert.ok(rendered.includes("line-through"))
})

test("an unavailable advertisement offers only the regular purchase price", () => {
  const rendered = renderCard({
    display_price: 80000,
    display_original_price: 100000,
    advertisement_available: false,
  })
  assert.ok(rendered.includes(formatCurrency(100000)))
  assert.ok(!rendered.includes(formatCurrency(80000)))
  assert.ok(!rendered.includes("Giá sau khi xem quảng cáo"))
})
