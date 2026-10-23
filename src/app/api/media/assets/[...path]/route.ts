import { env } from "@/config/env"
import { safePublicMediaPath } from "@/lib/backend-privacy"

export const dynamic = "force-dynamic"

const maximumBytes = 3 * 1024 * 1024
const allowedTypes = new Set([
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/avif",
  "image/bmp",
])

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const path = safePublicMediaPath((await params).path)
  if (!path) return new Response(null, { status: 404 })
  const controller = new AbortController()
  try {
    const upstream = await fetch(
      `${env.BACKEND_API_URL}/media/assets/${path}`,
      {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.any([
          request.signal,
          controller.signal,
          AbortSignal.timeout(30_000),
        ]),
        headers: { Accept: "image/*", "X-DealHay-Media-Transport": "stream" },
      }
    )
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel()
      return new Response(null, {
        status: upstream.status === 404 || upstream.status === 422 ? 404 : 502,
      })
    }
    const type = upstream.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase()
    const size = Number(upstream.headers.get("content-length"))
    if (
      !type ||
      !allowedTypes.has(type) ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > maximumBytes
    ) {
      await upstream.body.cancel()
      return new Response(null, { status: 502 })
    }
    const reader = upstream.body.getReader()
    let received = 0
    const stream = new ReadableStream<Uint8Array>({
      async pull(output) {
        try {
          const chunk = await reader.read()
          if (chunk.done) {
            if (received !== size) throw new Error("Incomplete image")
            reader.releaseLock()
            output.close()
            return
          }
          received += chunk.value.byteLength
          if (received > size || received > maximumBytes)
            throw new Error("Image too large")
          output.enqueue(chunk.value)
        } catch (error) {
          controller.abort()
          await reader.cancel().catch(() => {})
          reader.releaseLock()
          output.error(error)
        }
      },
      async cancel() {
        controller.abort()
        await reader.cancel()
        reader.releaseLock()
      },
    })
    return new Response(stream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(size),
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    controller.abort()
    return new Response(null, { status: 502 })
  }
}
