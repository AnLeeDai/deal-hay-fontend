import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`

function transpileModule(path, imports = {}) {
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
    outputText.replace(/from (["'])([^"']+)\1/g, (_match, quote, specifier) => {
      assert.ok(imports[specifier], `Unmocked import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}

const validationUrl = transpileModule("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const variantsUrl = transpileModule(
  "../src/modules/shop-management/lib/product-variants.ts"
)
const schemaUrl = transpileModule(
  "../src/modules/shop-management/schemas/shop-management.ts",
  {
    zod: import.meta.resolve("zod"),
    "@/lib/validation": validationUrl,
    "@/modules/shop-management/lib/product-variants": variantsUrl,
  }
)
const { createProductSchema } = await import(schemaUrl)
const apiUrl = moduleUrl(`
  export class ApiError extends Error {}
  export const state = { calls: [], revalidated: [] }
  export async function apiFetch(options) {
    state.calls.push(options)
    return { message: "Đã lưu." }
  }
  export async function createProduct(body) {
    state.calls.push({ body })
    return { message: "Đã tạo." }
  }
  export function revalidatePath(path) { state.revalidated.push(path) }
  export const replyToReview = () => {};
  export const createCoupon = () => {}; export const deleteCoupon = () => {};
  export const deleteProduct = () => {}; export const adjustInventory = () => {};
  export const reorderCategories = () => {}; export const updateOrderStatus = () => {};
  export const updateProductStatus = () => {};
`)
const actions = await import(
  transpileModule("../src/modules/shop-management/actions.ts", {
    "next/cache": apiUrl,
    "@/api/client": apiUrl,
    "@/api/catalog/mutations": apiUrl,
    "@/api/profile/mutations": apiUrl,
    "@/modules/shop-management/lib/product-variants": variantsUrl,
    "@/modules/shop-management/schemas/shop-management": schemaUrl,
  })
)
const { state } = await import(apiUrl)

function productDraft(overrides = {}) {
  return {
    name: "Áo thun",
    category: "Thời trang",
    price: 80000,
    old_price: 100000,
    video_url: "",
    stock: 10,
    label: "",
    description: "Sản phẩm mới",
    image: new File(["image"], "product.png", { type: "image/png" }),
    gallery_images: [],
    has_variants: false,
    options: [],
    variants: [],
    ...overrides,
  }
}

function productFormData(overrides = {}) {
  const draft = productDraft(overrides)
  const form = new FormData()
  for (const field of [
    "name",
    "category",
    "price",
    "old_price",
    "video_url",
    "stock",
    "label",
    "description",
  ]) {
    form.set(field, String(draft[field]))
  }
  form.set("image", draft.image)
  form.set(
    "catalog",
    JSON.stringify({ has_variants: false, options: [], variants: [] })
  )
  return form
}

test.beforeEach(() => {
  state.calls.length = 0
  state.revalidated.length = 0
})

test("shops can configure a discount without adding an advertising video", () => {
  const parsed = createProductSchema.safeParse(productDraft())
  assert.equal(parsed.success, true)
  assert.equal(parsed.data.old_price, 100000)
  assert.equal(parsed.data.price, 80000)
})

test("discounts still require an original price above the sale price", () => {
  const parsed = createProductSchema.safeParse(
    productDraft({ old_price: 70000 })
  )
  assert.equal(parsed.success, false)
  assert.ok(parsed.error.issues.some((issue) => issue.path[0] === "old_price"))
})

test("camera image batches larger than 32 MB can be prepared before upload", () => {
  const cameraImage = new File(
    [new Uint8Array(17 * 1024 * 1024)],
    "camera.jpg",
    { type: "image/jpeg" }
  )

  const parsed = createProductSchema.safeParse(
    productDraft({ image: cameraImage, gallery_images: [cameraImage] })
  )

  assert.equal(parsed.success, true)
})

test("source image preparation still rejects files above 30 MB and galleries above 50 images", () => {
  const oversized = new File(
    [new Uint8Array(30 * 1024 * 1024 + 1)],
    "large.jpg",
    { type: "image/jpeg" }
  )
  assert.equal(
    createProductSchema.safeParse(productDraft({ image: oversized })).success,
    false
  )
  const image = productDraft().image
  assert.equal(
    createProductSchema.safeParse(
      productDraft({ gallery_images: Array(51).fill(image) })
    ).success,
    false
  )
})

test("a staged 51-image product submission forwards references without any image binaries", async () => {
  const form = productFormData()
  form.delete("image")
  form.set("primary_image_upload", "primary-upload-token")
  for (let index = 0; index < 50; index++) {
    form.append("gallery_image_uploads", `gallery-upload-token-${index}`)
  }

  const result = await actions.createProductAction(form)
  assert.equal(result.success, true)
  const payload = state.calls[0].body
  assert.equal(payload.get("primary_image_upload"), "primary-upload-token")
  assert.deepEqual(
    payload.getAll("gallery_image_uploads[]"),
    Array.from({ length: 50 }, (_, index) => `gallery-upload-token-${index}`)
  )
  assert.equal(payload.has("image"), false)
  assert.equal(payload.has("gallery_images[]"), false)
  assert.ok(
    Array.from(payload.values()).every((value) => typeof value === "string")
  )
})

test("staged uploads retain catalog validation and reject galleries above fifty images", async () => {
  const form = productFormData()
  form.delete("image")
  form.set("primary_image_upload", "primary-upload-token")
  for (let index = 0; index < 51; index++)
    form.append("gallery_image_uploads", `gallery-${index}`)
  const result = await actions.createProductAction(form)
  assert.equal(result.success, false)
  assert.ok(result.errors.gallery_image_uploads)
  assert.equal(state.calls.length, 0)

  form.delete("gallery_image_uploads")
  form.set(
    "catalog",
    JSON.stringify({ has_variants: true, options: [], variants: [] })
  )
  const invalidCatalog = await actions.createProductAction(form)
  assert.equal(invalidCatalog.success, false)
  assert.ok(invalidCatalog.errors.variants)
  assert.equal(state.calls.length, 0)
})

test("the server action still rejects combined image payloads above 32 MB", async () => {
  const cameraImage = new File(
    [new Uint8Array(17 * 1024 * 1024)],
    "camera.jpg",
    { type: "image/jpeg" }
  )
  const form = productFormData({ image: cameraImage })
  form.append("gallery_images", cameraImage)

  const result = await actions.createProductAction(form)

  assert.equal(result.success, false)
  assert.deepEqual(result.errors.gallery_images, [
    "Tổng dung lượng ảnh sản phẩm không được vượt quá 32 MB.",
  ])
  assert.equal(state.calls.length, 0)
})

test("discounted product creation forwards product media and ignores manual ad fields", async () => {
  const form = productFormData({ video_url: "https://example.com/product.mp4" })
  form.set("advertisement_video_url", "https://example.com/manual-ad.mp4")
  form.set("advertisement_duration_seconds", "30")
  const result = await actions.createProductAction(form)
  assert.equal(result.success, true)
  assert.equal(state.calls.length, 1)
  const payload = state.calls[0].body
  assert.equal(payload.get("old_price"), "100000")
  assert.equal(payload.get("price"), "80000")
  assert.equal(payload.get("video_url"), "https://example.com/product.mp4")
  assert.equal(payload.has("advertisement_video_url"), false)
  assert.equal(payload.has("advertisement_duration_seconds"), false)
})

test("price updates keep product media separate from centrally supplied ads", async () => {
  const form = productFormData({ video_url: "https://example.com/product.mp4" })
  form.set("advertisement_video_url", "https://example.com/manual-ad.mp4")
  form.set("advertisement_duration_seconds", "30")
  const result = await actions.updateProductPricingAction("product-1", form)
  assert.equal(result.success, true)
  assert.equal(state.calls[0].method, "PATCH")
  assert.deepEqual(state.calls[0].body, {
    old_price: 100000,
    price: 80000,
    video_url: "https://example.com/product.mp4",
  })
})
