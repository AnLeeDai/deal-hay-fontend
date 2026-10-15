"use server"

import { getRealtimeConfig } from "@/api/chats/queries"
import type { RealtimeConfig } from "@/api/chats/types"

export async function loadRealtimeConfigAction(): Promise<RealtimeConfig | null> {
  try {
    return await getRealtimeConfig()
  } catch {
    return null
  }
}
