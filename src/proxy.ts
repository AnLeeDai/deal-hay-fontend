import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { AUTH_ROLE_COOKIE, AUTH_TOKEN_COOKIE } from "@/lib/cookies"

const protectedPrefixes = [
  "/profile",
  "/notifications",
  "/chats",
  "/shop-manage",
  "/admin",
]
const guestOnlyPrefixes = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
]

export function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value
  const role = request.cookies.get(AUTH_ROLE_COOKIE)?.value
  const pathname = request.nextUrl.pathname

  if (
    protectedPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  ) {
    if (!token) {
      const signInUrl = new URL("/sign-in", request.url)
      signInUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(signInUrl)
    }

    if (pathname.startsWith("/admin") && role !== "administrator") {
      return NextResponse.redirect(new URL("/forbidden", request.url))
    }
  }

  if (
    token &&
    guestOnlyPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  ) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/forgot-password/:path*",
    "/reset-password/:path*",
    "/profile/:path*",
    "/notifications/:path*",
    "/chats/:path*",
    "/shop-manage/:path*",
    "/admin/:path*",
  ],
}
