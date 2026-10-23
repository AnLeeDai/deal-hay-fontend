import { cookies } from "next/headers"

import { env } from "@/config/env"
import { privateJsonResponse } from "@/lib/backend-privacy"
import { AUTH_TOKEN_COOKIE } from "@/lib/cookies"

export const dynamic = "force-dynamic"

function allowedPath(path: string, method: string): boolean {
  if (method === "GET") {
    return /^(auth\/me|realtime\/config|notifications|messages(?:\/[a-zA-Z0-9_-]+(?:\/history)?)?)$/.test(
      path
    )
  }
  if (method === "POST") {
    return /^(presence\/heartbeat|messages\/[a-zA-Z0-9_-]+|uploads\/images\/prepare)$/.test(
      path
    )
  }
  return (
    method === "PATCH" &&
    /^(messages\/[a-zA-Z0-9_-]+\/read|notifications\/(read-visible|read-all|[a-fA-F0-9-]+\/read))$/.test(
      path
    )
  )
}

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params
  const upstreamPath = path.join("/")
  const apiPath =
    upstreamPath === "uploads/images/prepare" ? ["private", ...path] : path
  if (!allowedPath(upstreamPath, request.method)) {
    return Response.json(
      { message: "Không tìm thấy chức năng." },
      { status: 404 }
    )
  }
  const origin = request.headers.get("origin")
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== new URL(request.url).origin)
  ) {
    return Response.json({ message: "Yêu cầu không hợp lệ." }, { status: 403 })
  }
  const token = (await cookies()).get(AUTH_TOKEN_COOKIE)?.value
  if (!token) {
    return Response.json(
      { message: "Vui lòng đăng nhập lại." },
      { status: 401 }
    )
  }
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  })
  for (const name of ["content-type", "idempotency-key", "x-socket-id"]) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const options: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
    redirect: "error",
  }
  if (request.method !== "GET") {
    options.body = request.body
    options.duplex = "half"
  }
  try {
    const upstream = await fetch(
      `${env.BACKEND_API_URL}/${apiPath.map(encodeURIComponent).join("/")}${new URL(request.url).search}`,
      options
    )
    return privateJsonResponse(upstream)
  } catch {
    return Response.json(
      { message: "Kết nối tạm gián đoạn. Vui lòng thử lại." },
      { status: 503 }
    )
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH }
