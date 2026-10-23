import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { PNG } from "pngjs"
import {
  BinaryBitmap,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} from "@zxing/library"
import ts from "typescript"

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL(
      "../src/modules/shop-management/lib/inventory-labels.ts",
      import.meta.url
    ),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
)
const source = outputText.replace(
  /import\(["']qrcode["']\)/g,
  `import(${JSON.stringify(import.meta.resolve("qrcode"))})`
)
const { inventoryLabels, printInventoryLabels } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
)

const productId = "019a10bf-e4d2-7000-8000-111111111111"
const variantId = "019a10bf-e4d2-7000-8000-222222222222"
function product(overrides = {}) {
  return {
    id: productId,
    sku: "SKU-001",
    name: "Áo thun",
    price: 100000,
    stock: 12,
    has_variants: false,
    is_active: true,
    variants: [],
    retired_variants: [],
    ...overrides,
  }
}
function variant(overrides = {}) {
  return {
    id: variantId,
    sku: "SKU-001-RED",
    option_values: { "Màu sắc": "Đỏ", Size: "M" },
    variant_label: "",
    stock: 5,
    price: null,
    is_active: true,
    retired_at: null,
    ...overrides,
  }
}

function decodeQrDataUrl(dataUrl) {
  const { data, width, height } = PNG.sync.read(
    Buffer.from(dataUrl.split(",")[1], "base64")
  )
  const pixels = new Int32Array(width * height)
  for (let index = 0; index < pixels.length; index++) {
    pixels[index] =
      (data[index * 4] << 16) | (data[index * 4 + 1] << 8) | data[index * 4 + 2]
  }
  const bitmap = new BinaryBitmap(
    new HybridBinarizer(new RGBLuminanceSource(pixels, width, height))
  )
  return new QRCodeReader().decode(bitmap).getText()
}

let popup
let opened
let events
test.beforeEach(() => {
  opened = 0
  events = []
  popup = {
    document: {
      body: { textContent: "" },
      images: [],
      open() {
        events.push("open")
      },
      write(html) {
        this.html = html
        this.images = Array.from(
          html.matchAll(/<img src="([^"]+)"/g),
          (match) => ({
            src: match[1],
            async decode() {
              events.push("decode")
            },
          })
        )
      },
      close() {
        events.push("document-close")
      },
    },
    focus() {
      events.push("focus")
    },
    print() {
      events.push("print")
    },
    close() {
      events.push("popup-close")
    },
  }
  globalThis.window = {
    open() {
      opened++
      return popup
    },
  }
})
test.afterEach(() => {
  delete globalThis.window
})

test("product and variant QR identifiers remain stable when their names or SKUs change", () => {
  const first = inventoryLabels([product()])[0]
  const renamed = inventoryLabels([
    product({ name: "Tên mới", sku: "NEW-SKU" }),
  ])[0]
  assert.equal(first.code, `DH:P:${productId}`)
  assert.equal(renamed.code, first.code)

  const variants = inventoryLabels([
    product({ has_variants: true, variants: [variant()] }),
  ])
  const changed = inventoryLabels([
    product({
      has_variants: true,
      name: "Tên mới",
      variants: [variant({ sku: "NEW-VARIANT-SKU" })],
    }),
  ])
  assert.equal(variants.length, 1)
  assert.equal(variants[0].code, `DH:V:${variantId}`)
  assert.equal(changed[0].code, variants[0].code)
  assert.equal(variants[0].price, 100000)
  assert.equal(variants[0].stock, 5)
  assert.equal(variants[0].variant, "Màu sắc: Đỏ / Size: M")
})

test("hidden products and variants remain available for inventory while retired variants are excluded", () => {
  const result = inventoryLabels([
    product({ is_active: false }),
    product({
      id: "second-product",
      has_variants: true,
      variants: [
        variant({ is_active: false, price: 90000, variant_label: "Đỏ / M" }),
        variant({ id: "retired", retired_at: "2026-10-22T01:00:00Z" }),
      ],
      retired_variants: [variant({ id: "retired-separate" })],
    }),
  ])
  assert.equal(result.length, 2)
  assert.deepEqual(
    result.map((label) => label.active),
    [false, false]
  )
  assert.equal(result[1].price, 90000)
  assert.equal(result[1].variant, "Đỏ / M")
  assert.ok(result.every((label) => !label.code.includes("retired")))
})

test("printed PNG QR codes decode to the exact product and variant identifiers, and images load before printing", async () => {
  const labels = inventoryLabels([
    product(),
    product({ id: "other-product", has_variants: true, variants: [variant()] }),
  ])
  const result = printInventoryLabels(labels, 2)
  assert.equal(
    opened,
    1,
    "the popup must open synchronously before awaiting QR creation"
  )
  await result

  assert.equal(popup.document.images.length, 4)
  assert.deepEqual(
    popup.document.images.map((image) => decodeQrDataUrl(image.src)),
    [
      `DH:P:${productId}`,
      `DH:P:${productId}`,
      `DH:V:${variantId}`,
      `DH:V:${variantId}`,
    ]
  )
  assert.equal(events.filter((event) => event === "decode").length, 4)
  assert.deepEqual(events.slice(-2), ["focus", "print"])
  assert.ok(!events.includes("popup-close"))
})

test("print markup escapes names, variant text and SKUs without changing the encoded identifier", async () => {
  const labels = inventoryLabels([
    product({
      name: '<script>alert("x")</script> & Áo',
      sku: `SKU<'"&>`,
      has_variants: true,
      variants: [
        variant({ sku: `SKU<'"&>`, variant_label: '<img onerror="boom">' }),
      ],
    }),
  ])
  await printInventoryLabels(labels, 1)
  const html = popup.document.html
  assert.ok(
    html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Áo")
  )
  assert.ok(html.includes("&lt;img onerror=&quot;boom&quot;&gt;"))
  assert.ok(html.includes("SKU&lt;&#39;&quot;&amp;&gt;"))
  assert.ok(!html.includes("<script>"))
  assert.ok(!html.includes('<img onerror="boom">'))
  assert.equal(
    decodeQrDataUrl(popup.document.images[0].src),
    `DH:V:${variantId}`
  )
})

test("invalid print counts and batches above 1000 labels are rejected before opening a popup", async () => {
  const labels = inventoryLabels([product()])
  for (const copies of [0, -1, 1.5, 101, Number.NaN, Infinity]) {
    await assert.rejects(
      printInventoryLabels(labels, copies),
      /tối đa 1000 tem/
    )
  }
  await assert.rejects(printInventoryLabels([], 1), /tối đa 1000 tem/)
  await assert.rejects(
    printInventoryLabels(
      Array.from({ length: 11 }, () => labels[0]),
      100
    ),
    /tối đa 1000 tem/
  )
  assert.equal(opened, 0)
})

test("blocked print popups and image-loading failures surface errors without printing incomplete labels", async () => {
  const labels = inventoryLabels([product()])
  globalThis.window.open = () => null
  await assert.rejects(printInventoryLabels(labels, 1), /chặn cửa sổ in/)
  globalThis.window.open = () => popup
  const originalWrite = popup.document.write.bind(popup.document)
  popup.document.write = function (html) {
    originalWrite(html)
    this.images[0].decode = async () => {
      throw new Error("PNG loading failed")
    }
  }
  await assert.rejects(printInventoryLabels(labels, 1), /PNG loading failed/)
  assert.ok(events.includes("popup-close"))
  assert.ok(!events.includes("print"))
})
