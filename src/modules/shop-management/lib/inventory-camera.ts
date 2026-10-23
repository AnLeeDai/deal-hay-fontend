type CameraControls = { stop: () => void | Promise<void> }
type DecodedCode = { getText: () => string }
type CameraDecoder = {
  scan: (
    video: HTMLVideoElement,
    callback: (
      result: DecodedCode | undefined,
      error: unknown,
      controls: CameraControls
    ) => void
  ) => CameraControls
}
type CameraDependencies = {
  secureContext: boolean
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  loadDecoder: () => Promise<CameraDecoder>
}

type CameraCallbacks = {
  onScan: (sku: string) => void
  onError: (message: string) => void
  onReady?: () => void
}

function namedError(name: string): Error {
  const error = new Error(name)
  error.name = name
  return error
}

function errorKind(error: unknown): string {
  if (!error || typeof error !== "object") return ""
  if ("getKind" in error && typeof error.getKind === "function")
    return String(error.getKind())
  return "name" in error ? String(error.name) : ""
}

function cameraMessage(error: unknown, stage: string): string {
  switch (errorKind(error)) {
    case "InsecureContextError":
      return "Quét bằng camera cần HTTPS hoặc localhost. Bạn vẫn có thể dùng máy quét hoặc nhập SKU trên tem."
    case "UnsupportedCameraError":
      return "Trình duyệt này không hỗ trợ mở camera. Hãy dùng trình duyệt khác hoặc nhập SKU trên tem."
    case "NotAllowedError":
    case "SecurityError":
      return "Camera chưa được cấp quyền. Hãy cho phép camera trong trình duyệt rồi bật lại, hoặc nhập SKU trên tem."
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Không tìm thấy camera. Kiểm tra kết nối camera hoặc dùng máy quét / nhập SKU trên tem."
    case "NotReadableError":
    case "TrackStartError":
      return "Không đọc được camera. Hãy đóng ứng dụng đang dùng camera rồi bật lại."
    case "TimeoutError":
      return "Camera chưa phát được hình. Hãy đóng camera, kiểm tra thiết bị rồi bật lại."
    case "CameraEndedError":
      return "Camera đã ngắt kết nối. Hãy bật lại camera hoặc dùng máy quét / nhập SKU trên tem."
  }
  if (stage === "decoder")
    return "Không tải được bộ đọc QR. Kiểm tra kết nối rồi bật lại camera."
  if (stage === "decode")
    return "Camera đã dừng đọc QR. Hãy bật lại camera hoặc dùng máy quét / nhập SKU trên tem."
  return "Không mở được camera. Hãy kiểm tra quyền camera và thiết bị, hoặc nhập SKU trên tem."
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      /* Continue releasing the other tracks. */
    }
  }
}

function waitForVideo(
  video: HTMLVideoElement,
  stream: MediaStream,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    let finished = false
    let playing = false
    const events = ["loadedmetadata", "loadeddata", "playing"]
    const cleanup = () => {
      clearTimeout(timer)
      events.forEach((event) => video.removeEventListener(event, check))
      video.removeEventListener("error", failed)
      signal.removeEventListener("abort", aborted)
    }
    const finish = (error?: unknown) => {
      if (finished) return
      finished = true
      cleanup()
      if (error) reject(error)
      else resolve()
    }
    const check = () => {
      if (signal.aborted || video.srcObject !== stream)
        return finish(namedError("AbortError"))
      if (
        playing &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      )
        finish()
    }
    const failed = () => finish(namedError("VideoError"))
    const aborted = () => finish(namedError("AbortError"))
    const timer = setTimeout(() => finish(namedError("TimeoutError")), 12_000)
    events.forEach((event) => video.addEventListener(event, check))
    video.addEventListener("error", failed)
    signal.addEventListener("abort", aborted, { once: true })
    if (signal.aborted) return aborted()
    try {
      Promise.resolve(video.play()).then(() => {
        playing = true
        check()
      }, finish)
    } catch (error) {
      finish(error)
    }
  })
}

export function startInventoryCamera(
  video: HTMLVideoElement,
  callbacks: CameraCallbacks,
  overrides: Partial<CameraDependencies> = {}
): CameraControls {
  const dependencies: CameraDependencies = {
    secureContext: typeof window !== "undefined" && window.isSecureContext,
    getUserMedia: (constraints) => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      )
        throw namedError("UnsupportedCameraError")
      return navigator.mediaDevices.getUserMedia(constraints)
    },
    loadDecoder: async () => {
      const { BrowserQRCodeReader } = await import("@zxing/browser")
      return new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 150,
        delayBetweenScanSuccess: 150,
      })
    },
    ...overrides,
  }
  let stopped = false
  let stream: MediaStream | undefined
  let controls: CameraControls | undefined
  let stage = "decoder"
  const abort = new AbortController()
  const stoppedControls = new Set<CameraControls>()
  const listeners: Array<() => void> = []
  const stopDecoder = (target?: CameraControls) => {
    if (!target || stoppedControls.has(target)) return
    stoppedControls.add(target)
    try {
      void Promise.resolve(target.stop()).catch(() => {})
    } catch {
      /* The owned media stream still needs releasing. */
    }
  }
  const stop = () => {
    if (stopped) return
    stopped = true
    abort.abort()
    listeners.splice(0).forEach((remove) => remove())
    stopDecoder(controls)
    if (stream) {
      stopTracks(stream)
      if (video.srcObject === stream) {
        try {
          video.pause()
        } catch {
          /* Detached previews may already be paused. */
        }
        video.srcObject = null
      }
    }
  }
  const fail = (error: unknown) => {
    if (stopped) return
    const message = cameraMessage(error, stage)
    stop()
    callbacks.onError(message)
  }
  const decoded = (
    result: DecodedCode | undefined,
    error: unknown,
    decoderControls: CameraControls
  ) => {
    if (stopped) return
    controls = decoderControls
    if (
      error &&
      !["NotFoundException", "ChecksumException", "FormatException"].includes(
        errorKind(error)
      )
    ) {
      fail(error)
      return
    }
    const sku = result?.getText().trim()
    if (!sku) return
    stop()
    try {
      callbacks.onScan(sku)
    } catch {
      callbacks.onError(
        "Đã đọc được SKU nhưng chưa ghi nhận được. Hãy nhập lại SKU trên tem."
      )
    }
  }
  async function start() {
    try {
      if (!dependencies.secureContext) throw namedError("InsecureContextError")
      const decoder = await dependencies.loadDecoder()
      if (stopped) return
      stage = "camera"
      let acquired: MediaStream
      try {
        acquired = await dependencies.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
      } catch (error) {
        if (stopped) return
        if (errorKind(error) !== "OverconstrainedError") throw error
        acquired = await dependencies.getUserMedia({
          audio: false,
          video: true,
        })
      }
      stream = acquired
      if (stopped) {
        stopTracks(acquired)
        return
      }
      video.muted = true
      video.playsInline = true
      video.srcObject = acquired
      for (const track of acquired.getVideoTracks()) {
        const ended = () => fail(namedError("CameraEndedError"))
        track.addEventListener("ended", ended)
        listeners.push(() => track.removeEventListener("ended", ended))
      }
      stage = "video"
      await waitForVideo(video, acquired, abort.signal)
      if (stopped) return
      stage = "decode"
      callbacks.onReady?.()
      const activeControls = decoder.scan(video, decoded)
      controls = activeControls
      if (stopped) stopDecoder(activeControls)
    } catch (error) {
      fail(error)
    }
  }
  void start()
  return { stop }
}
