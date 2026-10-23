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
const firstUnitId = "019a10bf-e4d2-7000-8000-333333333333"
const secondUnitId = "019a10bf-e4d2-7000-8000-444444444444"
const firstSku = `DHU-${firstUnitId.toUpperCase()}`
const secondSku = `DHU-${secondUnitId.toUpperCase()}`
function unit(overrides = {}) {
  return {
    id: firstUnitId,
    code: `DH:U:${firstUnitId}`,
    sku: firstSku,
    shop_product_id: productId,
    shop_product_variant_id: null,
    product_name: "Áo thun",
    variant_name: null,
    price: 100000,
    stock: 1,
    is_active: true,
    status: "available",
    ...overrides,
  }
}
function secondUnit(overrides = {}) {
  return unit({
    id: secondUnitId,
    code: `DH:U:${secondUnitId}`,
    sku: secondSku,
    shop_product_variant_id: variantId,
    variant_name: "Đỏ / M",
    ...overrides,
  })
}
function decodeQrDataUrl(dataUrl) {
  const { data, width, height } = PNG.sync.read(
    Buffer.from(dataUrl.split(",")[1], "base64")
  )
  const pixels = new Int32Array(width * height)
  for (let index = 0; index < pixels.length; index++)
    pixels[index] =
      (data[index * 4] << 16) | (data[index * 4 + 1] << 8) | data[index * 4 + 2]
  return new QRCodeReader()
    .decode(
      new BinaryBitmap(
        new HybridBinarizer(new RGBLuminanceSource(pixels, width, height))
      )
    )
    .getText()
}
let popup, opened, events
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

test("each physical unit retains its issued unique SKU and QR across renames and reprints", async () => {
  const labels = inventoryLabels([unit(), secondUnit()])
  assert.deepEqual(
    labels.map(({ code }) => code),
    [firstSku, secondSku]
  )
  assert.deepEqual(
    labels.map(({ sku }) => sku),
    [firstSku, secondSku]
  )
  assert.deepEqual(
    labels.map(({ stock }) => stock),
    [1, 1]
  )
  const renamed = inventoryLabels([
    unit({ product_name: "Tên mới", price: 150000 }),
  ])
  assert.equal(renamed[0].code, labels[0].code)
  assert.equal(renamed[0].sku, labels[0].sku)
  assert.equal(renamed[0].price, 150000)
  await printInventoryLabels(labels)
  const firstCodes = popup.document.images.map((image) =>
    decodeQrDataUrl(image.src)
  )
  await printInventoryLabels(labels)
  assert.deepEqual(
    popup.document.images.map((image) => decodeQrDataUrl(image.src)),
    firstCodes
  )
})

test("hidden inventory keeps its individual labels and variant names", () => {
  const result = inventoryLabels([
    unit({ is_active: false }),
    secondUnit({ is_active: false, price: 90000 }),
  ])
  assert.deepEqual(
    result.map(({ active }) => active),
    [false, false]
  )
  assert.equal(result[1].price, 90000)
  assert.equal(result[1].variant, "Đỏ / M")
})

test("printed PNG QR codes decode to unique physical units, with one label per unit and images ready before printing", async () => {
  const result = printInventoryLabels(inventoryLabels([unit(), secondUnit()]))
  assert.equal(opened, 1, "open synchronously before awaiting QR creation")
  await result
  assert.equal(popup.document.images.length, 2)
  assert.deepEqual(
    popup.document.images.map((image) => decodeQrDataUrl(image.src)),
    [firstSku, secondSku]
  )
  assert.equal(events.filter((event) => event === "decode").length, 2)
  assert.deepEqual(events.slice(-2), ["focus", "print"])
  assert.ok(!events.includes("popup-close"))
})

test("print markup escapes names, variant text and SKUs without changing the physical unit QR", async () => {
  const labels = inventoryLabels([
    secondUnit({
      product_name: '<script>alert("x")</script> & Áo',
      sku: `DHU<'"&>`,
      variant_name: '<img onerror="boom">',
    }),
  ])
  await printInventoryLabels(labels)
  const html = popup.document.html
  assert.ok(
    html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Áo")
  )
  assert.ok(html.includes("&lt;img onerror=&quot;boom&quot;&gt;"))
  assert.ok(html.includes("DHU&lt;&#39;&quot;&amp;&gt;"))
  assert.ok(!html.includes("<script>"))
  assert.ok(!html.includes('<img onerror="boom">'))
  assert.equal(decodeQrDataUrl(popup.document.images[0].src), `DHU<'"&>`)
})

test("copies and invalid batch sizes are rejected before opening a popup", async () => {
  const labels = inventoryLabels([unit()])
  for (const copies of [0, -1, 1.5, 2, 100, Number.NaN, Infinity])
    await assert.rejects(
      printInventoryLabels(labels, copies),
      /tối đa 1000 tem/
    )
  await assert.rejects(printInventoryLabels([], 1), /tối đa 1000 tem/)
  await assert.rejects(
    printInventoryLabels(Array.from({ length: 1001 }, () => labels[0])),
    /tối đa 1000 tem/
  )
  assert.equal(opened, 0)
})

test("printed QR ignores legacy or rich API codes and contains only the unit SKU", async () => {
  for (const code of [
    `DH:P:${productId}`,
    `DH:V:${variantId}`,
    `DH:U:${secondUnitId}`,
    '{"sku":"wrong","id":"metadata"}',
  ]) {
    const labels = inventoryLabels([unit({ code })])
    assert.equal(labels[0].code, firstSku)
    await printInventoryLabels(labels)
    assert.equal(decodeQrDataUrl(popup.document.images[0].src), firstSku)
  }
})

test("mismatched QR payloads, aggregate quantities and duplicate unit identities cannot be printed", async () => {
  for (const code of [
    `DH:P:${productId}`,
    `DH:V:${variantId}`,
    `DH:U:${secondUnitId}`,
    "another-SKU",
  ]) {
    await assert.rejects(
      printInventoryLabels([{ ...inventoryLabels([unit()])[0], code }]),
      /QR riêng từng đơn vị/
    )
  }
  await assert.rejects(
    printInventoryLabels(inventoryLabels([unit({ stock: 2 })])),
    /QR riêng từng đơn vị/
  )
  await assert.rejects(
    printInventoryLabels(inventoryLabels([unit(), unit()])),
    /trùng/
  )
  await assert.rejects(
    printInventoryLabels(
      inventoryLabels([unit(), secondUnit({ sku: firstSku.toLowerCase() })])
    ),
    /trùng/
  )
  await assert.rejects(
    printInventoryLabels(
      inventoryLabels([unit(), secondUnit({ id: firstUnitId })])
    ),
    /trùng/
  )
  assert.equal(opened, 0)
})

test("blocked popups and image-loading failures surface errors without incomplete printing", async () => {
  const labels = inventoryLabels([unit()])
  globalThis.window.open = () => null
  await assert.rejects(printInventoryLabels(labels), /chặn cửa sổ in/)
  globalThis.window.open = () => popup
  const originalWrite = popup.document.write.bind(popup.document)
  popup.document.write = function (html) {
    originalWrite(html)
    this.images[0].decode = async () => {
      throw new Error("PNG loading failed")
    }
  }
  await assert.rejects(printInventoryLabels(labels), /PNG loading failed/)
  assert.ok(events.includes("popup-close"))
  assert.ok(!events.includes("print"))
})
