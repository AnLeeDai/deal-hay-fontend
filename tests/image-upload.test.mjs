import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpileModule(relativePath, imports = {}) {
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
      assert.ok(imports[specifier], `Unmocked import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}
const validationUrl = transpileModule("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const formUtilsUrl = transpileModule("../src/lib/form-utils.ts")
const grantUrl = moduleUrl(`
  export const state = { batches: [], discarded: [], result: null }
  export async function requestProductImageUploadsAction(uploads) {
    const batch = state.batches.length
    state.batches.push(uploads)
    return state.result ?? { success: true, data: { tokens: uploads.map((_, index) => 'batch-' + batch + '-token-' + index) } }
  }
  export async function discardProductImageUploadsAction(tokens) { state.discarded.push(tokens) }
`)
const { state: grants } = await import(grantUrl)
const { prepareImageUploads, transformImageFile, createImagePreview } =
  await import(
    transpileModule("../src/lib/image-upload.ts", {
      "@/lib/form-utils": formUtilsUrl,
      "@/lib/validation": validationUrl,
      "@/modules/media/actions": grantUrl,
    })
  )
let requests,
  activeUploads,
  peakUploads,
  activeDecoded,
  peakDecoded,
  releasedImages,
  drawSizes,
  canvasReferences,
  encodeCalls,
  bitmapOptions,
  encodeOutput
class FakeXHR {
  upload = {}
  headers = {}
  status = 204
  response = new ArrayBuffer(0)
  contentType = "application/json"
  done = false
  open(method, url) {
    this.method = method
    this.url = this.responseURL = url
  }
  setRequestHeader(name, value) {
    this.headers[name] = value
  }
  getResponseHeader(name) {
    return name === "content-type" ? this.contentType : null
  }
  send(payload) {
    this.payload = payload
    activeUploads++
    peakUploads = Math.max(peakUploads, activeUploads)
    requests.push(this)
  }
  progress(loaded, total) {
    this.upload.onprogress?.({ loaded, total, lengthComputable: true })
  }
  finish(
    status = 204,
    response = new ArrayBuffer(0),
    contentType = "application/json"
  ) {
    assert.equal(this.done, false)
    this.done = true
    activeUploads--
    Object.assign(this, { status, response, contentType })
    this.onload?.()
  }
  abort() {
    if (this.done) return
    this.done = this.aborted = true
    activeUploads--
    this.onabort?.()
  }
  failNetwork() {
    this.done = true
    activeUploads--
    this.onerror?.()
  }
}
function image(name = "camera.jpg", size = 300 * 1024) {
  return new File([new Uint8Array(size)], name, {
    type: "image/jpeg",
    lastModified: 1234,
  })
}
function batch(count = 2) {
  const form = new FormData()
  form.set("name", "Sản phẩm")
  form.set("image", image("main.jpg"))
  for (let index = 1; index < count; index++)
    form.append("gallery_images", image(`${index}.jpg`))
  return form
}
async function until(condition) {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (condition()) return
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.fail("Expected asynchronous upload state was not reached")
}
test.beforeEach(() => {
  requests = []
  activeUploads = peakUploads = activeDecoded = peakDecoded = releasedImages = 0
  drawSizes = []
  canvasReferences = []
  encodeCalls = []
  bitmapOptions = []
  grants.batches.length = grants.discarded.length = 0
  grants.result = null
  encodeOutput = () => ({ size: 12_000, type: "image/webp" })
  globalThis.window = { location: { origin: "https://shop.example.com" } }
  globalThis.XMLHttpRequest = FakeXHR
  globalThis.createImageBitmap = async (_, options) => {
    bitmapOptions.push(options)
    activeDecoded++
    peakDecoded = Math.max(peakDecoded, activeDecoded)
    return {
      width: 6000,
      height: 4000,
      close() {
        activeDecoded--
        releasedImages++
      },
    }
  }
  globalThis.document = {
    createElement(name) {
      assert.equal(name, "canvas")
      const canvas = {
        width: 0,
        height: 0,
        getContext() {
          return {
            drawImage(_, x, y, width, height) {
              drawSizes.push([width, height])
            },
          }
        },
        toBlob(callback, type, quality) {
          encodeCalls.push({
            width: this.width,
            height: this.height,
            quality,
            type,
          })
          const output = encodeOutput({
            width: this.width,
            height: this.height,
            quality,
            type,
          })
          setImmediate(() =>
            callback(
              output
                ? new Blob([new Uint8Array(output.size)], { type: output.type })
                : null
            )
          )
        },
      }
      canvasReferences.push(canvas)
      return canvas
    },
  }
})
test.afterEach(() => {
  for (const request of requests) if (!request.done) request.abort()
  for (const key of [
    "document",
    "createImageBitmap",
    "XMLHttpRequest",
    "window",
    "Image",
  ])
    delete globalThis[key]
})

test("camera preparation produces final WebP locally without an HTTP transform or original-file fallback", async () => {
  const source = image()
  const progress = []
  const output = await transformImageFile(source, "product", "gallery_images", {
    onProgress: (update) => progress.push(update),
  })
  assert.deepEqual(drawSizes, [[1280, 853]])
  assert.deepEqual(bitmapOptions, [{ imageOrientation: "from-image" }])
  assert.equal(output.name, "camera.webp")
  assert.equal(output.type, "image/webp")
  assert.equal(output.lastModified, 1234)
  assert.notEqual(output, source)
  assert.ok(output.size <= 512 * 1024)
  assert.equal(requests.length, 0)
  assert.equal(grants.batches.length, 0)
  assert.deepEqual(
    progress.map((update) => [update.stage, update.percent]),
    [
      ["preparing", 0],
      ["complete", 100],
    ]
  )
  assert.equal(releasedImages, 1)
  assert.equal(activeDecoded, 0)
  assert.equal(canvasReferences[0].width, 0)
  assert.equal(canvasReferences[0].height, 0)
})
test("avatar and preview dimensions remain bounded, sharing serialized decoding", async () => {
  const [avatar, preview] = await Promise.all([
    transformImageFile(image(), "avatar"),
    createImagePreview(image()),
  ])
  assert.deepEqual(drawSizes, [
    [640, 427],
    [160, 107],
  ])
  assert.equal(avatar.type, "image/webp")
  assert.equal(preview.type, "image/webp")
  assert.equal(peakDecoded, 1)
  assert.equal(releasedImages, 2)
  assert.equal(requests.length, 0)
})
test("compression tries the existing quality levels before reducing resolution", async () => {
  encodeOutput = ({ quality }) => ({
    type: "image/webp",
    size: quality === 0.54 ? 19_000 : 32_000,
  })
  const output = await transformImageFile(image(), "review")
  assert.equal(output.size, 19_000)
  assert.deepEqual(
    encodeCalls.map((call) => call.quality),
    [0.82, 0.68, 0.54]
  )
  assert.deepEqual(drawSizes, [[1280, 853]])
})
test("noisy images reduce dimensions and retry highest quality to fit the final 20 KiB budget", async () => {
  encodeOutput = ({ width }) => ({
    type: "image/webp",
    size: width > 640 ? 100_000 : 18_000,
  })
  const output = await transformImageFile(image(), "review")
  assert.ok(output.size <= 20 * 1024)
  assert.deepEqual(drawSizes, [
    [1280, 853],
    [640, 426],
  ])
  assert.deepEqual(
    encodeCalls.map((call) => call.quality),
    [0.82, 0.68, 0.54, 0.82]
  )
})
test("a browser without WebP encoding never uploads its PNG fallback, even for small originals", async () => {
  encodeOutput = () => ({ size: 1000, type: "image/png" })
  await assert.rejects(
    transformImageFile(image("small.jpg", 1000), "avatar"),
    /cập nhật trình duyệt/
  )
  assert.equal(requests.length, 0)
  assert.equal(grants.batches.length, 0)
  assert.equal(activeDecoded, 0)
  assert.equal(canvasReferences[0].width, 0)
})
test("failed browser decoding rejects both small and camera originals with an actionable error", async () => {
  delete globalThis.document
  for (const size of [1000, 300 * 1024])
    await assert.rejects(
      transformImageFile(image("failed.jpg", size), "product"),
      /đổi ảnh sang JPG, PNG hoặc WEBP/
    )
  assert.equal(requests.length, 0)
  assert.equal(grants.batches.length, 0)
})
test("HTML image decoding fallback is still local and releases its object URL", async () => {
  delete globalThis.createImageBitmap
  const originalCreate = URL.createObjectURL,
    originalRevoke = URL.revokeObjectURL
  const revoked = []
  URL.createObjectURL = () => "blob:fixture"
  URL.revokeObjectURL = (url) => revoked.push(url)
  globalThis.Image = class {
    naturalWidth = 320
    naturalHeight = 240
    set src(_) {
      queueMicrotask(() => this.onload())
    }
  }
  try {
    const output = await transformImageFile(image(), "chat")
    assert.equal(output.type, "image/webp")
    assert.deepEqual(drawSizes, [[320, 240]])
    assert.deepEqual(revoked, ["blob:fixture"])
  } finally {
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  }
})
test("uncompressible and empty encodes fail rather than returning an oversized or original file", async () => {
  for (const size of [100_000, 0]) {
    encodeOutput = () => ({ size, type: "image/webp" })
    await assert.rejects(
      transformImageFile(image(), "review"),
      /nén ảnh|nén ảnh xuống 20 KB/
    )
  }
  assert.equal(requests.length, 0)
  assert.equal(activeDecoded, 0)
  assert.ok(
    canvasReferences.every(
      (canvas) => canvas.width === 0 && canvas.height === 0
    )
  )
})
test("cancellation skips queued work and releases a decoded image when encoding was already running", async () => {
  const alreadyCancelled = new AbortController()
  alreadyCancelled.abort()
  await assert.rejects(
    createImagePreview(image(), alreadyCancelled.signal),
    /cancelled/
  )
  assert.equal(releasedImages, 0)
  const controller = new AbortController()
  encodeOutput = () => {
    controller.abort()
    return { size: 12000, type: "image/webp" }
  }
  await assert.rejects(
    transformImageFile(image(), "chat", "attachment", {
      signal: controller.signal,
    }),
    /tải ảnh|aborted/
  )
  assert.equal(activeDecoded, 0)
  assert.equal(requests.length, 0)
  encodeOutput = () => ({ size: 12000, type: "image/webp" })
  assert.equal((await transformImageFile(image(), "avatar")).type, "image/webp")
})
test("local batch normalization preserves repeated fields, metadata, original form and progress snapshots", async () => {
  const form = batch(3),
    snapshots = []
  const payload = await prepareImageUploads(form, "review", (progress) =>
    snapshots.push(progress)
  )
  assert.deepEqual(Array.from(payload.keys()), [
    "name",
    "image",
    "gallery_images",
    "gallery_images",
  ])
  assert.equal(payload.get("name"), "Sản phẩm")
  assert.deepEqual(
    payload.getAll("gallery_images").map((file) => file.name),
    ["1.webp", "2.webp"]
  )
  assert.equal(form.get("image").name, "main.jpg")
  assert.equal(snapshots[0].percent, 0)
  assert.equal(snapshots.at(-1).percent, 100)
  assert.equal(snapshots.at(-1).completed, 3)
  assert.ok(
    snapshots[0].files.every(
      (file) => file.stage === "queued" && file.percent === 0
    )
  )
  assert.equal(peakDecoded, 1)
  assert.equal(requests.length, 0)
})
test("chat non-image documents bypass normalization and preserve message metadata", async () => {
  const form = new FormData(),
    document = new File(["text"], "document.txt", { type: "text/plain" })
  form.set("attachment", document)
  form.set("body", "Nội dung")
  form.set("socket_id", "123.456")
  const payload = await prepareImageUploads(form, "chat")
  assert.equal(payload.get("attachment"), document)
  assert.equal(payload.get("body"), "Nội dung")
  assert.equal(payload.get("socket_id"), "123.456")
  assert.equal(releasedImages, 0)
  assert.equal(requests.length, 0)
})
test("a 51-image product uploads only final static WebP files and submits ordered references", async () => {
  const snapshots = [],
    result = prepareImageUploads(batch(51), "product", (update) =>
      snapshots.push(update)
    )
  await until(() => requests.length === 2)
  assert.equal(grants.batches.length, 1)
  assert.equal(grants.batches[0].length, 51)
  assert.ok(
    grants.batches[0].every(
      (upload) =>
        upload.size <= 512 * 1024 && upload.content_type === "image/webp"
    )
  )
  assert.equal(releasedImages, 51)
  assert.equal(peakDecoded, 1)
  for (let index = 0; index < 51; index++) {
    await until(() => requests.length > index)
    const request = requests[index]
    assert.equal(
      request.url,
      "https://shop.example.com/api/live/uploads/images/prepare"
    )
    assert.equal(request.payload.get("image").type, "image/webp")
    assert.equal(request.payload.get("image").size, 12000)
    assert.equal(request.payload.get("token"), `batch-0-token-${index}`)
    assert.equal(request.headers.Authorization, undefined)
    request.finish()
  }
  const payload = await result
  assert.equal(peakUploads, 2)
  assert.equal(activeUploads, 0)
  assert.equal(payload.get("primary_image_upload"), "batch-0-token-0")
  assert.deepEqual(
    payload.getAll("gallery_image_uploads"),
    Array.from({ length: 50 }, (_, index) => `batch-0-token-${index + 1}`)
  )
  assert.ok(
    Array.from(payload.values()).every((value) => typeof value === "string")
  )
  assert.equal(snapshots.at(-1).percent, 100)
  assert.equal(snapshots.at(-1).completed, 51)
})
test("upload progress uses actual transmitted bytes and only reaches completion after storage acknowledgement", async () => {
  const snapshots = [],
    result = prepareImageUploads(batch(1), "product", (update) =>
      snapshots.push(update)
    )
  await until(() => requests.length === 1)
  assert.equal(snapshots.at(-1).percent, 0)
  requests[0].progress(50, 100)
  assert.equal(snapshots.at(-1).percent, 50)
  requests[0].progress(100, 100)
  assert.equal(snapshots.at(-1).percent, 99)
  assert.equal(snapshots.at(-1).files[0].stage, "processing")
  requests[0].finish()
  await result
  assert.equal(snapshots.at(-1).percent, 100)
  assert.equal(snapshots.at(-1).completed, 1)
})
test("simultaneous product batches share two upload slots and keep staged tokens isolated", async () => {
  const result = Promise.all([
    prepareImageUploads(batch(), "product"),
    prepareImageUploads(batch(), "product"),
  ])
  for (let index = 0; index < 4; index++) {
    await until(() => requests.length > index)
    requests[index].finish()
  }
  const payloads = await result
  assert.equal(peakUploads, 2)
  assert.equal(peakDecoded, 1)
  assert.deepEqual(
    payloads.map((payload) => payload.get("primary_image_upload")),
    ["batch-0-token-0", "batch-1-token-0"]
  )
})
test("a rejected product upload aborts its sibling and discards all reserved tokens", async () => {
  const result = prepareImageUploads(batch(4), "product")
  await until(() => requests.length === 2)
  requests[0].finish(
    422,
    new TextEncoder().encode(
      JSON.stringify({
        message: "Ảnh bị hỏng",
        errors: { image: ["Ảnh không hợp lệ"] },
      })
    ).buffer
  )
  await assert.rejects(result, (error) => {
    assert.deepEqual(error.errors, { image: ["main.jpg: Ảnh không hợp lệ"] })
    return true
  })
  assert.equal(requests[1].aborted, true)
  assert.equal(requests.length, 2)
  assert.equal(activeUploads, 0)
  assert.deepEqual(grants.discarded, [
    Array.from({ length: 4 }, (_, index) => `batch-0-token-${index}`),
  ])
})
test("a transient network failure retries only the original staged token and releases its slot", async () => {
  const result = prepareImageUploads(batch(1), "product")
  await until(() => requests.length === 1)
  requests[0].failNetwork()
  await new Promise((resolve) => setTimeout(resolve, 1100))
  await until(() => requests.length === 2)
  requests[1].finish()
  const payload = await result
  assert.equal(grants.batches.length, 1)
  assert.equal(
    requests[0].payload.get("token"),
    requests[1].payload.get("token")
  )
  assert.equal(payload.get("primary_image_upload"), "batch-0-token-0")
  assert.equal(activeUploads, 0)
})
test("unreadable product sources fail before creating upload sessions or sending original images", async () => {
  delete globalThis.document
  const snapshots = []
  await assert.rejects(
    prepareImageUploads(batch(), "product", (update) => snapshots.push(update)),
    /đổi ảnh sang JPG/
  )
  assert.equal(grants.batches.length, 0)
  assert.equal(requests.length, 0)
  assert.equal(snapshots.at(-1).files[0].stage, "error")
})

test("previews reject oversized and unsupported sources before allocating a decoded bitmap", async () => {
  await assert.rejects(
    createImagePreview(image("large.jpg", 30 * 1024 * 1024 + 1)),
    /30 MB/
  )
  await assert.rejects(
    createImagePreview(
      new File(["heic"], "camera.heic", { type: "image/heic" })
    ),
    /định dạng/
  )
  assert.equal(bitmapOptions.length, 0)
  assert.equal(canvasReferences.length, 0)
})

test("a staged upload never accepts a successful HTML page or unexpected response as storage acknowledgement", async () => {
  const result = prepareImageUploads(batch(1), "product")
  await until(() => requests.length === 1)
  requests[0].finish(
    200,
    new TextEncoder().encode("<html>Login</html>").buffer,
    "text/html"
  )
  await assert.rejects(result, /chưa xác nhận lưu ảnh/)
  assert.equal(grants.discarded.length, 1)
  assert.equal(activeUploads, 0)
})

test("product photos preserve 1280px detail above 20 KiB within the existing 512 KiB budget", async () => {
  encodeOutput = () => ({ size: 320 * 1024, type: "image/webp" })
  const output = await transformImageFile(image(), "product")
  assert.equal(output.size, 320 * 1024)
  assert.deepEqual(drawSizes, [[1280, 853]])
  assert.deepEqual(
    encodeCalls.map((call) => call.quality),
    [0.82]
  )
  assert.equal(requests.length, 0)
})
