import { cookies } from "next/headers"

import { env } from "@/config/env"
import { AUTH_TOKEN_COOKIE } from "@/lib/cookies"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const token = (await cookies()).get(AUTH_TOKEN_COOKIE)?.value

  if (!token) {
    return new Response(null, { status: 401 })
  }

  const { messageId } = await params
  let upstream: Response
  try {
    upstream = await fetch(
      `${env.BACKEND_API_URL}/messages/attachments/${encodeURIComponent(messageId)}`,
      {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.any([_request.signal, AbortSignal.timeout(30_000)]),
        headers: {
          Accept: "*/*",
          Authorization: `Bearer ${token}`,
        },
      }
    )
  } catch {
    return new Response(null, { status: 503 })
  }

  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel()
    return new Response(null, { status: upstream.status })
  }

  const responseHeaders = new Headers()
  for (const name of [
    "content-type",
    "content-disposition",
    "content-length",
    "cache-control",
  ]) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }
  responseHeaders.set("X-Content-Type-Options", "nosniff")
  responseHeaders.set("Vary", "Cookie")

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}
