"use server"

import { ApiError } from "@/api/client"
import { getDiagnostics } from "@/api/diagnostics/queries"
import { requireAuth } from "@/lib/auth"
import type { DiagnosticsActionResult } from "@/types/diagnostics"

export async function measureDiagnosticsAction(): Promise<DiagnosticsActionResult> {
  await requireAuth("/diagnostics")

  try {
    const startedAt = performance.now()
    const data = await getDiagnostics()

    return {
      success: true,
      data: {
        ...data,
        api_latency_ms: Math.round((performance.now() - startedAt) * 100) / 100,
      },
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError && error.status === 429
          ? "Bạn đang đo quá thường xuyên. Vui lòng đợi một phút rồi thử lại."
          : "Không thể đo độ trễ hệ thống. Vui lòng thử lại sau.",
    }
  }
}
