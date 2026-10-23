import type { SpeedtestSession, SpeedtestState } from "@/types/speedtest"

const KIB = 1024
const MIB = 1024 * KIB
const PING_SAMPLES = 7
const TRANSFER_SAMPLES = 6
const REQUEST_TIMEOUT_MS = 15_000

export function initialSpeedtestState(): SpeedtestState {
  return {
    phase: "idle",
    progress: 0,
    pingMs: null,
    jitterMs: null,
    downloadMbps: null,
    uploadMbps: null,
    liveMbps: null,
    samples: { download: [], upload: [] },
    serverHost: null,
    completedAt: null,
    elapsedMs: 0,
    transferredBytes: 0,
    error: null,
  }
}

export function throughputMbps(bytes: number, durationMs: number): number {
  return bytes > 0 && durationMs > 0 ? (bytes * 8) / (durationMs * 1000) : 0
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const center = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[center]
    : (sorted[center - 1] + sorted[center]) / 2
}

export function jitterMs(values: number[]): number {
  if (values.length < 2) return 0
  return (
    values
      .slice(1)
      .reduce((sum, value, index) => sum + Math.abs(value - values[index]), 0) /
    (values.length - 1)
  )
}

function abortError(): DOMException {
  return new DOMException("Lượt đo đã dừng.", "AbortError")
}

function randomPayload(size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size)
  for (let offset = 0; offset < size; offset += 65_536) {
    crypto.getRandomValues(
      bytes.subarray(offset, Math.min(size, offset + 65_536))
    )
  }
  return bytes
}

type SpeedtestDependencies = {
  fetch?: typeof fetch
  now?: () => number
  payload?: (size: number) => Uint8Array<ArrayBuffer>
}

export async function measureSpeedtest(
  session: SpeedtestSession,
  signal: AbortSignal,
  onUpdate: (state: SpeedtestState) => void,
  dependencies: SpeedtestDependencies = {}
): Promise<SpeedtestState> {
  const request = dependencies.fetch ?? fetch
  const now = dependencies.now ?? (() => performance.now())
  const payload = dependencies.payload ?? randomPayload
  const startedAt = now()
  const endpoint = new URL(session.endpointUrl)
  if (
    !/^https?:$/.test(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error("Địa chỉ máy chủ đo không hợp lệ.")
  let state: SpeedtestState = {
    ...initialSpeedtestState(),
    serverHost: endpoint.host,
  }
  let requests = 0
  const emit = (update: Partial<SpeedtestState>) => {
    if (signal.aborted) throw abortError()
    state = { ...state, ...update, elapsedMs: now() - startedAt }
    onUpdate(state)
  }
  const maxDownload = Math.min(4 * MIB, session.limits.max_download_bytes)
  const maxUpload = Math.min(2 * MIB, session.limits.max_upload_bytes)
  if (
    !Number.isSafeInteger(maxDownload) ||
    maxDownload < 1 ||
    !Number.isSafeInteger(maxUpload) ||
    maxUpload < 1
  )
    throw new Error("Giới hạn dữ liệu đo không hợp lệ.")

  async function probe<T>(
    path: string,
    bytes: number,
    body: Uint8Array<ArrayBuffer> | undefined,
    read: (response: Response, start: number) => Promise<T>
  ): Promise<{ value: T; durationMs: number }> {
    if (signal.aborted) throw abortError()
    if (
      ++requests > session.limits.max_requests ||
      state.transferredBytes + bytes > session.limits.max_session_bytes
    )
      throw new Error("Lượt đo đã đạt giới hạn dữ liệu. Vui lòng đo lại.")
    // Keep each probe URL stable so adaptive sizes can reuse CORS preflight.
    // API responses use no-store. Let the browser reuse CORS permission caching;
    // fetch cache:no-store would also force fresh preflights in Chromium.
    const url = new URL(`${endpoint.href.replace(/\/$/, "")}/${path}`)
    const controller = new AbortController()
    const cancel = () => controller.abort()
    signal.addEventListener("abort", cancel, { once: true })
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const start = now()
    try {
      const response = await request(url, {
        method: body ? "POST" : "GET",
        mode: "cors",
        credentials: "omit",
        cache: "default",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${session.token}`,
          ...(path === "download"
            ? { "X-Speedtest-Bytes": String(bytes) }
            : {}),
          ...(body ? { "Content-Type": "application/octet-stream" } : {}),
        },
        body,
        signal: controller.signal,
      })
      if (signal.aborted) throw abortError()
      if (!response.ok) {
        if (response.status === 401 || response.status === 403)
          throw new Error(
            "Phiên đo đã hết hạn. Bấm đo lại để bắt đầu phiên mới."
          )
        if (response.status === 429)
          throw new Error(
            "Máy chủ đã đạt giới hạn lượt đo. Vui lòng đợi một phút rồi thử lại."
          )
        throw new Error("Máy chủ chưa phản hồi được lượt đo. Vui lòng thử lại.")
      }
      const value = await read(response, start)
      if (signal.aborted) throw abortError()
      return { value, durationMs: now() - start }
    } catch (error) {
      if (signal.aborted) throw abortError()
      if (controller.signal.aborted)
        throw new Error(
          "Kết nối phản hồi quá chậm. Vui lòng kiểm tra mạng rồi đo lại."
        )
      if (error instanceof TypeError)
        throw new Error("Không kết nối được đến máy chủ đo. Vui lòng thử lại.")
      throw error
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener("abort", cancel)
    }
  }

  async function ping(): Promise<number> {
    const result = await probe("ping", 0, undefined, async (response) => {
      if (response.status !== 204)
        throw new Error("Phản hồi đo ping không hợp lệ.")
      await response.arrayBuffer()
    })
    return result.durationMs
  }

  emit({ phase: "ping", progress: 5 })
  await ping() // Warm the browser connection and CORS preflight before sampling RTT.
  const latencies: number[] = []
  for (let index = 0; index < PING_SAMPLES; index++) {
    latencies.push(await ping())
    emit({
      pingMs: median(latencies),
      jitterMs: jitterMs(latencies),
      progress: 5 + ((index + 1) / PING_SAMPLES) * 20,
    })
  }

  for (const phase of ["download", "upload"] as const) {
    const maxSize = phase === "download" ? maxDownload : maxUpload
    let size = Math.min(maxSize, (phase === "download" ? 256 : 128) * KIB)
    let totalBytes = 0
    let totalMs = 0
    const uploadData = phase === "upload" ? payload(maxUpload) : undefined
    emit({ phase, liveMbps: null, progress: phase === "download" ? 25 : 65 })
    for (let index = 0; index < TRANSFER_SAMPLES; index++) {
      const phaseStart = phase === "download" ? 25 : 65
      const phaseSpan = phase === "download" ? 40 : 35
      const completedBytes = state.transferredBytes
      const result = await probe(
        phase,
        size,
        uploadData?.subarray(0, size),
        async (response, start) => {
          if (phase === "upload") {
            const acknowledgement: unknown = await response.json()
            if (
              !acknowledgement ||
              typeof acknowledgement !== "object" ||
              !("received_bytes" in acknowledgement) ||
              acknowledgement.received_bytes !== size
            )
              throw new Error(
                "Máy chủ chưa xác nhận đủ dữ liệu tải lên. Vui lòng đo lại."
              )
            return size
          }
          if (
            !response.headers
              .get("Content-Type")
              ?.toLowerCase()
              .includes("application/octet-stream")
          )
            throw new Error("Phản hồi tải xuống không hợp lệ.")
          let received = 0
          let lastUpdate = start
          if (response.body) {
            const reader = response.body.getReader()
            try {
              for (;;) {
                const part = await reader.read()
                if (part.done) break
                received += part.value.byteLength
                if (received > size) {
                  await reader.cancel()
                  throw new Error("Dữ liệu đo vượt quá kích thước đã yêu cầu.")
                }
                const instant = now()
                if (instant - lastUpdate >= 100) {
                  lastUpdate = instant
                  emit({
                    liveMbps: throughputMbps(received, instant - start),
                    transferredBytes: completedBytes + received,
                    progress:
                      phaseStart +
                      ((index + received / size) / TRANSFER_SAMPLES) *
                        phaseSpan,
                  })
                }
              }
            } finally {
              reader.releaseLock()
            }
          } else received = (await response.arrayBuffer()).byteLength
          if (received !== size)
            throw new Error("Dữ liệu tải xuống chưa đầy đủ. Vui lòng đo lại.")
          return received
        }
      )
      if (result.durationMs <= 0)
        throw new Error(
          "Chưa lấy được thời gian truyền dữ liệu. Vui lòng đo lại."
        )
      totalBytes += result.value
      totalMs += result.durationMs
      const speed = throughputMbps(result.value, result.durationMs)
      const average = throughputMbps(totalBytes, totalMs)
      emit({
        transferredBytes: completedBytes + result.value,
        liveMbps: speed,
        ...(phase === "download"
          ? { downloadMbps: average }
          : { uploadMbps: average }),
        progress: phaseStart + ((index + 1) / TRANSFER_SAMPLES) * phaseSpan,
        samples: {
          ...state.samples,
          [phase]: [
            ...state.samples[phase],
            { elapsedMs: now() - startedAt, mbps: speed },
          ],
        },
      })
      const desired =
        Math.ceil((size * 500) / result.durationMs / (64 * KIB)) * 64 * KIB
      size = Math.min(maxSize, Math.max(Math.min(64 * KIB, maxSize), desired))
    }
  }
  emit({
    phase: "complete",
    progress: 100,
    liveMbps: null,
    completedAt: new Date().toISOString(),
  })
  return state
}
