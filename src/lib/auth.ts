import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getCurrentSession } from "@/api/auth/queries"
import { isProduction } from "@/config/env"
import {
  AUTH_NAME_COOKIE,
  AUTH_ROLE_COOKIE,
  AUTH_TOKEN_COOKIE,
} from "@/lib/cookies"
import type { AuthPayload, User } from "@/types/auth"

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction,
  path: "/",
}

export async function setAuthCookies(payload: AuthPayload): Promise<void> {
  const store = await cookies()
  store.set(AUTH_TOKEN_COOKIE, payload.token, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  })
  store.set(AUTH_ROLE_COOKIE, payload.user.role, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  })
  store.set(AUTH_NAME_COOKIE, payload.user.full_name || payload.user.email, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies()
  store.delete(AUTH_TOKEN_COOKIE)
  store.delete(AUTH_ROLE_COOKIE)
  store.delete(AUTH_NAME_COOKIE)
}

export async function requireAuth(): Promise<User> {
  const session = await getCurrentSession()
  if (!session.user) {
    redirect("/sign-in")
  }
  return session.user
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth()
  if (user.role !== "administrator") {
    redirect("/forbidden")
  }
  return user
}
