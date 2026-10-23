import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  ChecksumException,
  FormatException,
  NotFoundException,
} from "@zxing/library"
import ts from "typescript"

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL(
      "../src/modules/shop-management/lib/inventory-camera.ts",
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
const { startInventoryCamera } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
)
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
class Video extends EventTarget {
  constructor(ready = true) {
    super()
    this.readyState = ready ? 4 : 0
    this.videoWidth = ready ? 1280 : 0
    this.videoHeight = ready ? 720 : 0
    this.sources = []
    this._source = null
    this.paused = true
  }
  get srcObject() {
    return this._source
  }
  set srcObject(value) {
    this.sources.push(value)
    this._source = value
  }
  async play() {
    this.paused = false
  }
  pause() {
    this.paused = true
  }
}
function media() {
  const track = new EventTarget()
  track.stopCount = 0
  track.stop = () => {
    track.stopCount++
  }
  return {
    track,
    stream: { getTracks: () => [track], getVideoTracks: () => [track] },
  }
}
function harness(overrides = {}) {
  const video = overrides.video ?? new Video()
  const { track, stream } = overrides.media ?? media()
  const calls = {
    camera: [],
    scans: 0,
    ready: 0,
    stop: 0,
    skus: [],
    errors: [],
  }
  let decode
  const controls = {
    stop() {
      calls.stop++
      return overrides.stop?.()
    },
  }
  const decoder = {
    scan(element, callback) {
      assert.equal(element, video)
      calls.scans++
      decode = callback
      overrides.onStart?.(callback, controls)
      return controls
    },
  }
  const scanner = startInventoryCamera(
    video,
    {
      onReady() {
        calls.ready++
      },
      onScan(sku) {
        calls.skus.push(sku)
      },
      onError(message) {
        calls.errors.push(message)
      },
    },
    {
      secureContext: overrides.secureContext ?? true,
      loadDecoder: overrides.loadDecoder ?? (async () => decoder),
      getUserMedia: async (constraints) => {
        calls.camera.push(constraints)
        return overrides.getUserMedia
          ? overrides.getUserMedia(constraints)
          : stream
      },
    }
  )
  return {
    scanner,
    calls,
    track,
    stream,
    video,
    controls,
    emit(result, error) {
      decode(result, error, controls)
    },
  }
}

test("normal ZXing misses keep the camera running and a plain SKU is handed off exactly once", async () => {
  const camera = harness()
  await flush()
  assert.equal(camera.calls.scans, 1)
  assert.equal(camera.calls.ready, 1)
  for (const error of [
    new NotFoundException(),
    new FormatException(),
    new ChecksumException(),
  ])
    camera.emit(undefined, error)
  camera.emit({ getText: () => "   " })
  assert.equal(camera.track.stopCount, 0)
  assert.equal(camera.calls.errors.length, 0)
  camera.emit({ getText: () => "  DHU-1234567890  " })
  camera.emit({ getText: () => "DHU-OTHER" })
  assert.deepEqual(camera.calls.skus, ["DHU-1234567890"])
  assert.equal(camera.calls.stop, 1)
  assert.equal(camera.track.stopCount, 1)
  assert.equal(camera.video.srcObject, null)
  camera.scanner.stop()
  assert.equal(
    camera.track.stopCount,
    1,
    "cleanup is idempotent after successful handoff"
  )
})

test("fatal frame errors are reported instead of leaving a silently stopped scanner", async () => {
  const camera = harness()
  await flush()
  camera.emit(
    undefined,
    new DOMException("frame unavailable", "InvalidStateError")
  )
  assert.match(camera.calls.errors[0], /Camera đã dừng đọc QR/)
  assert.equal(camera.track.stopCount, 1)
  assert.equal(camera.calls.stop, 1)
  assert.equal(camera.video.srcObject, null)
})

test("a result produced synchronously before scan returns still stops and reaches the caller", async () => {
  const camera = harness({
    onStart(callback, controls) {
      callback({ getText: () => "DHU-SYNC-0001" }, undefined, controls)
    },
  })
  await flush()
  assert.deepEqual(camera.calls.skus, ["DHU-SYNC-0001"])
  assert.equal(camera.calls.stop, 1)
  assert.equal(camera.track.stopCount, 1)
})

test("cancelling before the decoder loads does not ask for camera permission later", async () => {
  const pending = deferred()
  const camera = harness({ loadDecoder: () => pending.promise })
  camera.scanner.stop()
  pending.resolve({
    scan() {
      throw Error("must not decode")
    },
  })
  await flush()
  assert.equal(camera.calls.camera.length, 0)
  assert.deepEqual(camera.calls.errors, [])
})

test("a late permission result from a cancelled run cannot replace or clear the reopened camera", async () => {
  const video = new Video()
  const pending = deferred()
  const first = harness({ video, getUserMedia: () => pending.promise })
  await flush()
  assert.equal(first.calls.camera.length, 1)
  first.scanner.stop()
  const second = harness({ video })
  await flush()
  assert.equal(video.srcObject, second.stream)
  pending.resolve(first.stream)
  await flush()
  assert.equal(first.track.stopCount, 1)
  assert.equal(first.calls.scans, 0)
  assert.equal(first.calls.errors.length, 0)
  assert.equal(second.track.stopCount, 0)
  assert.equal(video.srcObject, second.stream)
  assert.ok(!video.sources.includes(first.stream))
  second.scanner.stop()
})

test("cancelling while video playback is starting leaves a newer preview untouched", async () => {
  const video = new Video(false)
  const playback = deferred()
  video.play = () => playback.promise
  const first = harness({ video })
  await flush()
  assert.equal(video.srcObject, first.stream)
  first.scanner.stop()
  video.readyState = 4
  video.videoWidth = 1280
  video.videoHeight = 720
  video.play = async () => {}
  const second = harness({ video })
  await flush()
  playback.resolve()
  await flush()
  assert.equal(first.calls.scans, 0)
  assert.deepEqual(first.calls.errors, [])
  assert.equal(video.srcObject, second.stream)
  assert.equal(second.calls.scans, 1)
  second.scanner.stop()
})

test("the decoder waits for nonzero playable video dimensions", async () => {
  const video = new Video(false)
  const camera = harness({ video })
  await flush()
  assert.equal(camera.calls.scans, 0)
  video.readyState = 4
  video.videoWidth = 1280
  video.videoHeight = 720
  video.dispatchEvent(new Event("loadeddata"))
  await flush()
  assert.equal(camera.calls.scans, 1)
  camera.scanner.stop()
})

test("camera playback timeout releases its stream and gives a useful error", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const camera = harness({ video: new Video(false) })
  await flush()
  t.mock.timers.tick(12_000)
  await flush()
  assert.match(camera.calls.errors[0], /Camera chưa phát được hình/)
  assert.equal(camera.track.stopCount, 1)
  assert.equal(camera.calls.scans, 0)
})

test("permission refusal, missing devices and busy cameras receive distinct actionable messages", async () => {
  for (const [name, expected] of [
    ["NotAllowedError", /chưa được cấp quyền/],
    ["NotFoundError", /Không tìm thấy camera/],
    ["NotReadableError", /đóng ứng dụng/],
  ]) {
    const camera = harness({
      getUserMedia: async () => {
        throw new DOMException(name, name)
      },
    })
    await flush()
    assert.match(camera.calls.errors[0], expected)
    assert.equal(
      camera.calls.camera.length,
      1,
      "permission errors are not retried"
    )
    assert.equal(camera.calls.scans, 0)
  }
  const insecure = harness({ secureContext: false })
  await flush()
  assert.match(insecure.calls.errors[0], /HTTPS hoặc localhost/)
  assert.equal(insecure.calls.camera.length, 0)
})

test("unsupported camera constraints fall back to an available video device", async () => {
  const available = media()
  let requests = 0
  const camera = harness({
    media: available,
    getUserMedia: async () => {
      if (requests++ === 0)
        throw new DOMException("constraint unsupported", "OverconstrainedError")
      return available.stream
    },
  })
  await flush()
  assert.deepEqual(camera.calls.camera[0].video.facingMode, {
    ideal: "environment",
  })
  assert.deepEqual(camera.calls.camera[1], { audio: false, video: true })
  assert.equal(camera.calls.scans, 1)
  camera.scanner.stop()
})

test("decoder load failures, disconnected cameras and failed decoder cleanup do not leak streams", async () => {
  const unavailable = harness({
    loadDecoder: async () => {
      throw Error("network failure")
    },
  })
  await flush()
  assert.match(unavailable.calls.errors[0], /Không tải được bộ đọc QR/)
  const camera = harness({
    stop: () => Promise.reject(Error("decoder cleanup failure")),
  })
  await flush()
  camera.track.dispatchEvent(new Event("ended"))
  await flush()
  assert.match(camera.calls.errors[0], /Camera đã ngắt kết nối/)
  assert.equal(camera.track.stopCount, 1)
  camera.track.dispatchEvent(new Event("ended"))
  assert.equal(camera.calls.errors.length, 1)
})
