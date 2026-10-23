import "server-only"

import { env } from "@/config/env"

const mediaPrefix = "/api/media/assets/"

export function safePublicMediaPath(segments: string[]): string | null {
  const path = segments.join("/")
  if (
    path.length > 1024 ||
    segments.length < 1 ||
    segments.some(
      (segment) => !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(segment)
    ) ||
    ["chat-media", "staged-images"].includes(segments[0])
  )
    return null
  return segments.map(encodeURIComponent).join("/")
}

/** Remove the API origin before server data enters HTML, RSC or JSON responses. */
export function sanitizeBackendPayload<T>(value: T): T {
  const backend = new URL(env.BACKEND_API_URL)
  const apiPath = backend.pathname.replace(/\/+$/, "")
  const hostname = new RegExp(
    backend.hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "gi"
  )
  const mapUrl = (raw: string) => {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return raw
    }
    if (url.hostname.toLowerCase() !== backend.hostname.toLowerCase())
      return raw
    const assetPrefix = `${apiPath}/media/assets/`
    if (url.pathname.startsWith(assetPrefix)) {
      return `${mediaPrefix}${url.pathname.slice(assetPrefix.length)}`
    }
    const attachmentPrefix = `${apiPath}/messages/attachments/`
    if (url.pathname.startsWith(attachmentPrefix)) {
      return `/api/chat-attachments/${url.pathname.slice(attachmentPrefix.length)}`
    }
    if (url.pathname.startsWith("/storage/r2/")) {
      return `${mediaPrefix}${url.pathname.slice("/storage/r2/".length)}`
    }
    return `${url.pathname}${url.search}${url.hash}`
  }
  const visit = (item: unknown): unknown => {
    if (typeof item === "string") {
      return item
        .replace(/https?:\/\/[^\s<>"']+/g, mapUrl)
        .replace(hostname, "DealHay Backend")
    }
    if (Array.isArray(item)) return item.map(visit)
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item).map(([key, field]) => [
          key,
          // Reverb's public host must remain usable for the browser socket.
          key === "host" &&
          "broadcaster" in item &&
          item.broadcaster === "reverb"
            ? field
            : visit(field),
        ])
      )
    }
    return item
  }
  return visit(value) as T
}

/** Bound JSON transports so an upstream error page cannot expose internal URLs. */
export async function privateJsonResponse(
  upstream: Response
): Promise<Response> {
  const headers = { "Cache-Control": "no-store", Vary: "Cookie" }
  if (upstream.status === 204)
    return new Response(null, { status: 204, headers })
  if (!upstream.headers.get("content-type")?.includes("application/json")) {
    return Response.json(
      { message: "Kết nối tạm gián đoạn. Vui lòng thử lại." },
      { status: 502, headers }
    )
  }
  const reader = upstream.body?.getReader()
  if (!reader) return Response.json({}, { status: upstream.status, headers })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 4 * 1024 * 1024) throw new Error("Response too large")
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return Response.json(
      sanitizeBackendPayload(JSON.parse(new TextDecoder().decode(bytes))),
      { status: upstream.status, headers }
    )
  } catch {
    await reader.cancel().catch(() => {})
    return Response.json(
      { message: "Kết nối tạm gián đoạn. Vui lòng thử lại." },
      { status: 502, headers }
    )
  } finally {
    reader.releaseLock()
  }
}
