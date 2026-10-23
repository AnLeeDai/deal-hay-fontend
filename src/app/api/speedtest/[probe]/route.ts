import { env } from "@/config/env"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const UPLOAD_MAX_BYTES = 2 * 1024 * 1024
const DOWNLOAD_MAX_BYTES = 4 * 1024 * 1024
const cacheHeaders = {
  "Cache-Control": "no-store, no-transform",
  "X-Content-Type-Options": "nosniff",
}

function failure(status: number) {
  const messages: Record<number, string> = {
    400: "Yêu cầu đo không hợp lệ.",
    401: "Phiên đo không hợp lệ hoặc đã hết hạn.",
    403: "Yêu cầu đo không được phép.",
    404: "Không tìm thấy chức năng đo.",
    405: "Phương thức đo không hợp lệ.",
    413: "Dữ liệu đo vượt quá giới hạn.",
    415: "Định dạng dữ liệu đo không hợp lệ.",
    422: "Dung lượng mẫu đo không hợp lệ.",
    429: "Vui lòng đợi một phút rồi đo lại.",
  }
  return Response.json(
    {
      message:
        messages[status] ??
        "Không kết nối được đến DealHay Backend. Vui lòng thử lại.",
    },
    { status, headers: cacheHeaders }
  )
}

async function forward(
  request: Request,
  context: { params: Promise<{ probe: string }> }
) {
  const { probe } = await context.params
  if (!["ping", "download", "upload"].includes(probe)) return failure(404)
  if (request.method !== (probe === "upload" ? "POST" : "GET"))
    return failure(405)
  const url = new URL(request.url)
  if (url.search) return failure(400)
  const origin = request.headers.get("origin")
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== url.origin)
  )
    return failure(403)
  const authorization = request.headers.get("authorization") ?? ""
  if (!/^Bearer [A-Za-z0-9]{64}$/.test(authorization)) return failure(401)

  const headers = new Headers({
    Authorization: authorization,
    Accept:
      probe === "download" ? "application/octet-stream" : "application/json",
    "Accept-Encoding": "identity",
  })
  let downloadBytes = 1024 * 1024
  if (probe === "download") {
    const value = request.headers.get("x-speedtest-bytes")
    if (value !== null) {
      if (
        !/^[1-9]\d*$/.test(value) ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) > DOWNLOAD_MAX_BYTES
      )
        return failure(422)
      downloadBytes = Number(value)
    }
    headers.set("X-Speedtest-Bytes", String(downloadBytes))
  }
  const controller = new AbortController()
  const signal = AbortSignal.any([
    controller.signal,
    request.signal,
    AbortSignal.timeout(30_000),
  ])
  let excessiveBody = false
  let invalidBodyLength = false
  let expectedLength: number | null = null
  let body: ReadableStream<Uint8Array> | undefined
  if (probe === "upload") {
    if (
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/octet-stream"
    )
      return failure(415)
    const length = request.headers.get("content-length")
    if (length !== null) {
      if (!/^[1-9]\d*$/.test(length) || !Number.isSafeInteger(Number(length)))
        return failure(400)
      if (Number(length) > UPLOAD_MAX_BYTES) return failure(413)
      expectedLength = Number(length)
      headers.set("Content-Length", length)
    }
    if (!request.body) return failure(400)
    headers.set("Content-Type", "application/octet-stream")
    const reader = request.body.getReader()
    let received = 0
    body = new ReadableStream<Uint8Array>({
      async pull(stream) {
        try {
          const next = await reader.read()
          if (next.done) {
            if (expectedLength !== null && received !== expectedLength) {
              invalidBodyLength = true
              controller.abort()
              reader.releaseLock()
              stream.error(new Error("Invalid upload length"))
              return
            }
            stream.close()
            reader.releaseLock()
            return
          }
          received += next.value.byteLength
          if (received > UPLOAD_MAX_BYTES) {
            excessiveBody = true
            controller.abort()
            await reader.cancel()
            reader.releaseLock()
            stream.error(new Error("Upload limit exceeded"))
            return
          }
          if (expectedLength !== null && received > expectedLength) {
            invalidBodyLength = true
            controller.abort()
            await reader.cancel()
            reader.releaseLock()
            stream.error(new Error("Invalid upload length"))
            return
          }
          stream.enqueue(next.value)
        } catch (error) {
          stream.error(error)
        }
      },
      async cancel(reason) {
        controller.abort()
        await reader.cancel(reason)
      },
    })
  }
  try {
    if (signal.aborted) return failure(503)
    const options: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal,
      ...(body ? { body, duplex: "half" } : {}),
    }
    const response = await fetch(
      `${env.BACKEND_API_URL}/diagnostics/speedtest/${probe}`,
      options
    )
    if (!response.ok) {
      await response.body?.cancel()
      const status = [400, 401, 403, 413, 415, 422, 429].includes(
        response.status
      )
        ? response.status
        : 503
      const error = failure(status)
      const retry = response.headers.get("retry-after")
      if (retry && /^\d{1,5}$/.test(retry))
        error.headers.set("Retry-After", retry)
      return error
    }
    const outgoing = new Headers(cacheHeaders)
    // Do not forward Location, upstream URLs or arbitrary diagnostic values.
    const timing = response.headers.get("server-timing")
    if (timing) {
      const safeTiming = timing
        .split(",")
        .map((part) => part.trim())
        .filter((part) =>
          /^(?:app|db|cache|lock|grant);dur=\d+(?:\.\d+)?$/.test(part)
        )
        .join(", ")
      if (safeTiming) outgoing.set("Server-Timing", safeTiming)
    }
    if (probe === "ping") {
      if (response.status !== 204) {
        await response.body?.cancel()
        return failure(503)
      }
      return new Response(null, { status: 204, headers: outgoing })
    }
    if (probe === "upload") {
      const acknowledgement: unknown = await response.json()
      if (
        !acknowledgement ||
        typeof acknowledgement !== "object" ||
        !("received_bytes" in acknowledgement) ||
        !Number.isSafeInteger(acknowledgement.received_bytes) ||
        Number(acknowledgement.received_bytes) < 1 ||
        Number(acknowledgement.received_bytes) > UPLOAD_MAX_BYTES
      )
        return failure(503)
      return Response.json(
        { received_bytes: acknowledgement.received_bytes },
        { headers: outgoing }
      )
    }
    const length = response.headers.get("content-length")
    if (
      response.status !== 200 ||
      !response.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/octet-stream") ||
      !response.body ||
      !length ||
      Number(length) !== downloadBytes
    ) {
      await response.body?.cancel()
      return failure(503)
    }
    outgoing.set("Content-Type", "application/octet-stream")
    outgoing.set("Content-Length", length)
    outgoing.set("Content-Encoding", "identity")
    outgoing.set("X-Speedtest-Bytes", length)
    const reader = response.body.getReader()
    let downloaded = 0
    let released = false
    const stop = () => {
      controller.abort()
      void reader.cancel().catch(() => {})
    }
    signal.addEventListener("abort", stop, { once: true })
    const release = () => {
      if (!released) {
        released = true
        signal.removeEventListener("abort", stop)
        reader.releaseLock()
      }
    }
    const stream = new ReadableStream<Uint8Array>({
      async pull(target) {
        try {
          if (signal.aborted) throw new Error("Cancelled")
          const next = await reader.read()
          if (next.done) {
            if (downloaded !== downloadBytes)
              throw new Error("Incomplete download")
            release()
            target.close()
            return
          }
          downloaded += next.value.byteLength
          if (downloaded > downloadBytes)
            throw new Error("Download limit exceeded")
          target.enqueue(next.value)
        } catch {
          const cancelled = signal.aborted
          controller.abort()
          if (!released) {
            await reader.cancel().catch(() => {})
            release()
          }
          target.error(
            cancelled
              ? new DOMException("Lượt đo đã dừng.", "AbortError")
              : new Error("Không nhận đủ dữ liệu từ DealHay Backend.")
          )
        }
      },
      async cancel(reason) {
        controller.abort()
        if (!released) {
          await reader.cancel(reason)
          release()
        }
      },
    })
    return new Response(stream, { headers: outgoing })
  } catch {
    controller.abort()
    return failure(excessiveBody ? 413 : invalidBodyLength ? 400 : 503)
  }
}

export { forward as GET, forward as POST }
