import { cookies } from "next/headers"

import { env } from "@/config/env"
import { AUTH_TOKEN_COOKIE } from "@/lib/cookies"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const token = (await cookies()).get(AUTH_TOKEN_COOKIE)?.value

  if (!token) {
    return Response.json({ message: "Unauthenticated." }, { status: 401 })
  }

  const upstreamUrl = new URL("/broadcasting/auth", env.BACKEND_API_URL)
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "Content-Type":
      request.headers.get("content-type") ??
      "application/x-www-form-urlencoded",
  })
  const socketId = request.headers.get("x-socket-id")
  if (socketId) headers.set("X-Socket-ID", socketId)

  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    cache: "no-store",
    headers,
    body: await request.text(),
  })
  const responseHeaders = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    "Cache-Control": "no-store",
    Vary: "Cookie",
  })

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  })
}
