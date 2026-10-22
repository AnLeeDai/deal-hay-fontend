export type DiagnosticCheck = {
  status: "ok" | "failed" | "skipped"
  latency_ms: number | null
  message: string
}

export type DiagnosticsResponse = {
  checked_at: string
  checks: Record<"database" | "cache" | "storage" | "reverb", DiagnosticCheck>
  duration_ms: number
}

export type DiagnosticsMeasurement = DiagnosticsResponse & {
  api_latency_ms: number
}

export type DiagnosticsActionResult =
  | { success: true; data: DiagnosticsMeasurement }
  | { success: false; message: string }
