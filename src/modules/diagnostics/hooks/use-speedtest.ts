"use client"

import { useEffect, useRef, useState } from "react"
import { startSpeedtestAction } from "@/modules/diagnostics/speedtest-actions"
import {
  initialSpeedtestState,
  measureSpeedtest,
} from "@/modules/diagnostics/lib/speedtest"
import type { SpeedtestState } from "@/types/speedtest"

export function useSpeedtest() {
  const [state, setState] = useState<SpeedtestState>(initialSpeedtestState)
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.abort()
      active.current = null
    }
  }, [])

  function start() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    const startedAt = performance.now()
    const current = () =>
      mounted.current &&
      active.current === controller &&
      !controller.signal.aborted
    setState({ ...initialSpeedtestState(), phase: "connecting" })
    void (async () => {
      try {
        const session = await startSpeedtestAction()
        if (!current()) return
        if (!session.success) throw new Error(session.message)
        const setupMs = performance.now() - startedAt
        await measureSpeedtest(session.data, controller.signal, (next) => {
          if (current())
            setState({ ...next, elapsedMs: next.elapsedMs + setupMs })
        })
      } catch (error) {
        if (current())
          setState((previous) => ({
            ...previous,
            phase: "error",
            error:
              error instanceof Error
                ? error.message
                : "Không thể đo kết nối. Vui lòng thử lại.",
            elapsedMs: performance.now() - startedAt,
          }))
      } finally {
        if (active.current === controller) active.current = null
      }
    })()
  }

  function cancel() {
    active.current?.abort()
    active.current = null
    setState((previous) => ({
      ...previous,
      phase: "cancelled",
      error: null,
      liveMbps: null,
    }))
  }

  return {
    state,
    start,
    cancel,
    running: ["connecting", "ping", "download", "upload"].includes(state.phase),
  }
}
