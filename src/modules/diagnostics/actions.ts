"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ApiError } from "@/api/client"
import { getDiagnostics } from "@/api/diagnostics/queries"
import { clearAuthCookies } from "@/lib/auth"
import { getAuthPageHref } from "@/lib/auth-redirect"
import { AUTH_TOKEN_COOKIE } from "@/lib/cookies"
import type { DiagnosticsActionResult } from "@/types/diagnostics"

export async function measureDiagnosticsAction(): Promise<DiagnosticsActionResult> {
  const token = (await cookies()).get(AUTH_TOKEN_COOKIE)?.value
  const signInHref = getAuthPageHref("/sign-in", "/diagnostics")
  if (!token) redirect(signInHref)

  try {
    const startedAt = performance.now()
    // The protected API validates this token; fetching /auth/me first adds a
    // second round trip without making this request's authorization stronger.
    const data = await getDiagnostics(token)

    return {
      success: true,
      data: {
        ...data,
        api_latency_ms: Math.round((performance.now() - startedAt) * 100) / 100,
      },
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearAuthCookies()
      redirect(signInHref)
    }

    return {
      success: false,
      message:
        error instanceof ApiError && error.status === 429
          ? "Bạn đang đo quá thường xuyên. Vui lòng đợi một phút rồi thử lại."
          : "Không thể đo độ trễ hệ thống. Vui lòng thử lại sau.",
    }
  }
}
