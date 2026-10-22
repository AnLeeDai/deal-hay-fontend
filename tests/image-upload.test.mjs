import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
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

const validationUrl = transpileModule("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const formUtilsUrl = transpileModule("../src/lib/form-utils.ts")
const grantUrl = moduleUrl(`
  export const state = { requests: [], result: null }
  export async function requestImageTransformAction(request) {
    state.requests.push(request)
    return state.result ?? { success: true, data: { url: "https://images.example.com/transform", token: "one-use-token" } }
  }
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

const webp = Uint8Array.from(Buffer.from("RIFF0000WEBP", "ascii")).buffer
let requests = []
let activeUploads = 0
let peakUploads = 0
let activeDecoded = 0
let peakDecoded = 0
let releasedImages = 0
let drawSizes = []
let canvasReferences = []

class FakeXHR {
  upload = {}
  headers = {}
  responseURL = "https://images.example.com/transform"
  status = 200
  response = webp
  contentType = "image/webp"
  done = false

  open(method, url) {
    this.method = method
    this.url = url
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
  finish(status = 200, response = webp, contentType = "image/webp") {
    assert.equal(this.done, false)
    this.done = true
    activeUploads--
    Object.assign(this, { status, response, contentType })
    this.onload?.()
  }
  abort() {
    if (this.done) return
    this.done = true
    this.aborted = true
    activeUploads--
    this.onabort?.()
  }
  failNetwork(event = "onerror") {
    this.done = true
    activeUploads--
    this[event]?.()
  }
}

function image(name = "camera.jpg", size = 300 * 1024) {
  return new File([new Uint8Array(size)], name, {
    type: "image/jpeg",
    lastModified: 1234,
  })
}

async function until(condition) {
  for (let attempt = 0; attempt < 100; attempt++) {
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
  grants.requests.length = 0
  grants.result = null
  globalThis.XMLHttpRequest = FakeXHR
  globalThis.createImageBitmap = async () => {
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
            drawImage(source, x, y, width, height) {
              drawSizes.push([width, height])
            },
            fillRect() {},
          }
        },
        toBlob(callback, type) {
          setImmediate(() =>
            callback(new Blob([new Uint8Array(12_000)], { type }))
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
  delete globalThis.document
  delete globalThis.createImageBitmap
  delete globalThis.XMLHttpRequest
})

test("camera images are resized before the grant and report completion only after a valid server acknowledgement", async () => {
  const progress = []
  const result = transformImageFile(image(), "product", "gallery_images", {
    onProgress: (update) => progress.push(update),
  })
  await until(() => requests.length === 1)
  const request = requests[0]

  assert.deepEqual(drawSizes, [[1280, 853]])
  assert.deepEqual(grants.requests, [{ size: 12_000, purpose: "product" }])
  assert.equal(request.payload.get("image").size, 12_000)
  assert.equal(request.headers.Authorization, "Bearer one-use-token")
  assert.equal(request.withCredentials, false)
  assert.equal(request.responseType, "arraybuffer")
  request.progress(50, 100)
  assert.equal(progress.at(-1).percent, 50)
  request.progress(100, 100)
  assert.equal(progress.at(-1).percent, 99)
  assert.equal(progress.at(-1).stage, "processing")
  assert.equal(
    progress.some((update) => update.percent === 100),
    false
  )

  request.finish()
  const output = await result

  assert.equal(output.name, "camera.webp")
  assert.equal(output.type, "image/webp")
  assert.equal(output.lastModified, 1234)
  assert.equal(progress.at(-1).percent, 100)
  assert.equal(progress.at(-1).stage, "complete")
  assert.equal(releasedImages, 1)
  assert.equal(canvasReferences[0].width, 0)
})

test("avatar preparation uses a smaller raster", async () => {
  const result = transformImageFile(image(), "avatar")
  await until(() => requests.length === 1)
  requests[0].finish()
  await result

  assert.deepEqual(drawSizes, [[640, 427]])
})

test("selected-image previews use small thumbnails and release their decoded camera source", async () => {
  const thumbnail = await createImagePreview(image())

  assert.deepEqual(drawSizes, [[160, 107]])
  assert.equal(thumbnail.type, "image/webp")
  assert.equal(releasedImages, 1)
  assert.equal(activeDecoded, 0)
  assert.equal(grants.requests.length, 0)
  assert.equal(requests.length, 0)
})

test("cancelled previews skip queued decoding and do not fall back to original camera files", async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    createImagePreview(image(), controller.signal),
    /cancelled/
  )
  assert.equal(releasedImages, 0)

  delete globalThis.document
  await assert.rejects(createImagePreview(image("small.jpg", 1000)), /256 KB/)
  assert.equal(grants.requests.length, 0)
})

test("multiple uploads decode one image at a time and keep at most two network requests active", async () => {
  const results = Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      transformImageFile(image(`${index}.jpg`), "product")
    )
  )
  await until(() => requests.length === 2 && releasedImages === 5)
  assert.equal(peakDecoded, 1)
  assert.equal(peakUploads, 2)

  for (let index = 0; index < 5; index++) {
    await until(() => requests.length > index)
    requests[index].finish()
  }
  await results

  assert.equal(peakUploads, 2)
  assert.equal(activeUploads, 0)
  assert.equal(activeDecoded, 0)
})

test("batch progress includes every image and preserves repeated fields and form order despite out-of-order responses", async () => {
  const form = new FormData()
  form.set("name", "Sản phẩm")
  form.set("image", image("main.jpg"))
  form.append("gallery_images", image("first.jpg"))
  form.append("gallery_images", image("second.jpg"))
  const snapshots = []
  const result = prepareImageUploads(form, "product", (progress) =>
    snapshots.push(progress)
  )
  await until(() => requests.length === 2)
  const firstSnapshot = snapshots[0]
  requests[1].progress(100, 100)
  requests[1].finish()
  await until(() => requests.length === 3)
  assert.equal(snapshots.at(-1).completed, 1)
  assert.equal(snapshots.at(-1).percent, 33)
  requests[2].finish()
  requests[0].finish()
  const payload = await result

  assert.deepEqual(Array.from(payload.keys()), [
    "name",
    "image",
    "gallery_images",
    "gallery_images",
  ])
  assert.equal(payload.get("name"), "Sản phẩm")
  assert.deepEqual(
    payload.getAll("gallery_images").map((file) => file.name),
    ["first.webp", "second.webp"]
  )
  assert.equal(snapshots.at(-1).percent, 100)
  assert.equal(snapshots.at(-1).completed, 3)
  assert.equal(firstSnapshot.percent, 0)
  assert.ok(firstSnapshot.files.every((file) => file.percent === 0))
})

test("a failed batch aborts its sibling upload, stops remaining images, and releases upload slots", async () => {
  const form = new FormData()
  for (let index = 0; index < 4; index++)
    form.append("gallery_images", image(`${index}.jpg`))
  const result = prepareImageUploads(form, "product")
  await until(() => requests.length === 2)
  requests[0].finish(
    422,
    new TextEncoder().encode(
      JSON.stringify({
        message: "Ảnh không hợp lệ",
        errors: { image: ["Ảnh bị hỏng"] },
      })
    ).buffer,
    "application/json"
  )

  await assert.rejects(result, (error) => {
    assert.match(error.message, /0.jpg: Ảnh không hợp lệ/)
    assert.deepEqual(error.errors, { gallery_images: ["0.jpg: Ảnh bị hỏng"] })
    return true
  })
  assert.equal(requests[1].aborted, true)
  assert.equal(grants.requests.length, 2)

  const retry = transformImageFile(image("retry.jpg"), "product")
  await until(() => requests.length === 3)
  requests[2].finish()
  assert.equal((await retry).name, "retry.webp")
  assert.equal(activeUploads, 0)
})

test("unsupported browser decoding permits only a small controlled backend fallback", async () => {
  delete globalThis.document
  await assert.rejects(transformImageFile(image(), "product"), /256 KB/)
  assert.equal(grants.requests.length, 0)

  const small = image("small.jpg", 1000)
  const result = transformImageFile(small, "product")
  await until(() => requests.length === 1)
  assert.equal(requests[0].payload.get("image"), small)
  assert.equal(grants.requests[0].size, small.size)
  requests[0].finish()
  await result
})

test("invalid transform responses never report completion", async () => {
  const progress = []
  const result = transformImageFile(image(), "product", "image", {
    onProgress: (update) => progress.push(update),
  })
  await until(() => requests.length === 1)
  requests[0].progress(100, 100)
  requests[0].finish(200, new TextEncoder().encode("not a webp").buffer)

  await assert.rejects(result, /Phản hồi xử lý ảnh không hợp lệ/)
  assert.equal(
    progress.some((update) => update.percent === 100),
    false
  )
  assert.equal(progress.at(-1).stage, "error")
})

test("network failures and timeouts release their upload slots for retry", async () => {
  for (const event of ["onerror", "ontimeout"]) {
    const result = transformImageFile(image(), "product")
    await until(() => requests.some((request) => !request.done))
    requests.find((request) => !request.done).failNetwork(event)
    await assert.rejects(result, /Không thể tải ảnh lên/)
  }
  const result = transformImageFile(image("retry.jpg"), "product")
  await until(() => requests.some((request) => !request.done))
  requests.find((request) => !request.done).finish()
  assert.equal((await result).name, "retry.webp")
})

test("chat documents bypass image preparation and preserve metadata", async () => {
  const form = new FormData()
  const document = new File(["text"], "document.txt", { type: "text/plain" })
  form.set("attachment", document)
  form.set("body", "Nội dung")
  form.set("socket_id", "123.456")

  const payload = await prepareImageUploads(form, "chat")

  assert.equal(payload.get("attachment"), document)
  assert.equal(payload.get("body"), "Nội dung")
  assert.equal(payload.get("socket_id"), "123.456")
  assert.equal(grants.requests.length, 0)
})
