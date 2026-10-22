import type { Metadata } from "next"

import { requireAuth } from "@/lib/auth"
import { DiagnosticsClient } from "@/modules/diagnostics/components/diagnostics-client"

export const metadata: Metadata = { title: "Độ trễ hệ thống" }

export default async function DiagnosticsPage() {
  await requireAuth("/diagnostics")
  return <DiagnosticsClient />
}
