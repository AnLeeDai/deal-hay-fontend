import { cache } from "react"
import { cookies } from "next/headers"

import { apiFetch, ApiError } from "@/api/client"
import { authRoutes } from "@/api/auth/routes"
import type { SessionResponse, MeResponse } from "@/api/auth/types"
import { AUTH_TOKEN_COOKIE } from "@/lib/cookies"

export const getCurrentSession = cache(async (): Promise<SessionResponse> => {
  const token = (await cookies()).get(AUTH_TOKEN_COOKIE)?.value
  const guestSession: SessionResponse = {
    user: null,
    unreadCounts: { messages: 0, notifications: 0 },
  }

  if (!token) return guestSession

  try {
    const response = await apiFetch<MeResponse>({ path: authRoutes.me, token })
    return {
      user: response.data,
      unreadCounts: {
        messages: response.meta.unread_messages_count,
        notifications: response.meta.unread_notifications_count,
      },
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return guestSession
    }
    throw error
  }
})
