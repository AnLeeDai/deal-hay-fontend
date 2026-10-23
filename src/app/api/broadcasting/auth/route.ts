import { cookies } from "next/headers"

import { env } from "@/config/env"
import { privateJsonResponse } from "@/lib/backend-privacy"
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

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      cache: "no-store",
      headers,
      body: await request.text(),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    })
    return privateJsonResponse(upstream)
  } catch {
    return Response.json(
      { message: "Kết nối tạm gián đoạn. Vui lòng thử lại." },
      { status: 503 }
    )
  }
}
