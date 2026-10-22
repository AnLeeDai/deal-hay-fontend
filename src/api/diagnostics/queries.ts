import { apiFetch } from "@/api/client"
import type { DiagnosticsResponse } from "@/types/diagnostics"

export function getDiagnostics(token: string): Promise<DiagnosticsResponse> {
  return apiFetch({ path: "/diagnostics", cache: "no-store", token })
}
