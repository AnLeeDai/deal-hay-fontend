"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { ApiError, apiFetch } from "@/api/client"
import { clearAuthCookies } from "@/lib/auth"
import { getAuthPageHref } from "@/lib/auth-redirect"
import { AUTH_TOKEN_COOKIE } from "@/lib/cookies"
import type { SpeedtestSessionResult } from "@/types/speedtest"

const grantSchema = z.object({
  token: z.string().regex(/^[a-zA-Z0-9]{64}$/),
  expires_at: z.iso.datetime({ offset: true }),
  endpoint_path: z.literal("/diagnostics/speedtest"),
  limits: z.object({
    max_download_bytes: z.number().int().positive(),
    max_upload_bytes: z.number().int().positive(),
    max_session_bytes: z.number().int().positive(),
    max_requests: z.number().int().positive(),
  }),
})

export async function startSpeedtestAction(): Promise<SpeedtestSessionResult> {
  const token = (await cookies()).get(AUTH_TOKEN_COOKIE)?.value
  const signInHref = getAuthPageHref("/sign-in", "/diagnostics")
  if (!token) redirect(signInHref)
  try {
    const response = grantSchema.parse(
      await apiFetch({
        method: "POST",
        path: "/diagnostics/speedtest/session",
        token,
      })
    )
    return {
      success: true,
      data: {
        token: response.token,
        endpointUrl: "/api/speedtest",
        expiresAt: response.expires_at,
        limits: response.limits,
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
          ? "Bạn đã bắt đầu nhiều lượt đo. Vui lòng đợi một phút rồi đo lại."
          : "Không thể bắt đầu đo kết nối đến máy chủ. Vui lòng thử lại.",
    }
  }
}
