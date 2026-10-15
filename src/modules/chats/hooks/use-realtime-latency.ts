"use client"

import { useEffect, useMemo, useState } from "react"
import type Echo from "laravel-echo"
import type { ConnectionStatus } from "laravel-echo"

type RealtimeSession = {
  echo: Echo<"reverb"> | null
  status: ConnectionStatus
  socketId?: string
}

type LatencySample = {
  session: RealtimeSession
  milliseconds: number | null
  timedOut: boolean
}

export function useRealtimeLatency({
  echo,
  status,
  socketId,
}: RealtimeSession) {
  const [sample, setSample] = useState<LatencySample | null>(null)
  const session = useMemo(
    () => ({ echo, status, socketId }),
    [echo, status, socketId]
  )

  useEffect(() => {
    const { echo, status, socketId } = session
    if (!echo || status !== "connected" || !socketId) return

    const connection = echo.connector.pusher.connection
    let startedAt: number | null = null
    let timeout: number | undefined
    let disposed = false

    const clearProbe = () => {
      window.clearTimeout(timeout)
      startedAt = null
    }

    const receiveMessage = ({ event }: { event: string }) => {
      if (disposed || event !== "pusher:pong" || startedAt === null) return

      const milliseconds = Math.max(
        0,
        Math.round(performance.now() - startedAt)
      )
      clearProbe()
      setSample({ session, milliseconds, timedOut: false })
    }

    const expireProbe = () => {
      clearProbe()
      if (!disposed) {
        setSample({ session, milliseconds: null, timedOut: true })
      }
    }

    const probe = () => {
      if (
        disposed ||
        startedAt !== null ||
        document.visibilityState !== "visible" ||
        connection.state !== "connected" ||
        connection.socket_id !== socketId
      ) {
        return
      }

      startedAt = performance.now()
      timeout = window.setTimeout(expireProbe, 5000)

      try {
        if (!connection.send_event("pusher:ping", {})) expireProbe()
      } catch {
        expireProbe()
      }
    }

    const handleVisibilityChange = () => {
      clearProbe()
      setSample(null)
      if (document.visibilityState === "visible") probe()
    }

    connection.bind("message", receiveMessage)
    const initialProbe = window.setTimeout(probe, 0)
    const interval = window.setInterval(probe, 15000)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      disposed = true
      clearProbe()
      window.clearTimeout(initialProbe)
      window.clearInterval(interval)
      connection.unbind("message", receiveMessage)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [session])

  const currentSample =
    status === "connected" && sample?.session === session ? sample : null

  return {
    latencyMs: currentSample?.milliseconds ?? null,
    pingTimedOut: currentSample?.timedOut ?? false,
  }
}
