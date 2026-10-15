"use client"

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"

const PREFERENCE_EVENT = "deal-hay:notification-sound-change"
const preferences = new Map<string, boolean>()

function readPreference(key: string): boolean {
  if (preferences.has(key)) return preferences.get(key) as boolean
  try {
    return window.localStorage.getItem(key) !== "muted"
  } catch {
    return preferences.get(key) ?? true
  }
}

function claimSound(key: string, eventId: string): boolean {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || "null")
    const ids: string[] = Array.isArray(stored?.ids)
      ? stored.ids.filter((id: unknown) => typeof id === "string").slice(-99)
      : []
    if (ids.includes(eventId)) return false

    const now = Date.now()
    const previousPlayedAt =
      typeof stored?.playedAt === "number" && Number.isFinite(stored.playedAt)
        ? stored.playedAt
        : null
    const elapsed =
      previousPlayedAt === null ? Infinity : now - previousPlayedAt
    const canPlay = elapsed < 0 || elapsed >= 1000
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ids: [...ids, eventId],
        playedAt: canPlay ? now : previousPlayedAt,
      })
    )
    return canPlay
  } catch {
    return true
  }
}

function playChime(context: AudioContext) {
  for (const [index, frequency] of [880, 1174].entries()) {
    const start = context.currentTime + index * 0.16
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.addEventListener(
      "ended",
      () => {
        oscillator.disconnect()
        gain.disconnect()
      },
      { once: true }
    )
    oscillator.start(start)
    oscillator.stop(start + 0.15)
  }
}

export function useNotificationSound(currentUserId?: string) {
  const preferenceKey = `deal-hay:notification-sound:${currentUserId ?? "guest"}`
  const player = useRef<{
    unlock: () => void
    play: (eventId: string) => void
  } | null>(null)

  const subscribe = useCallback(
    (onChange: () => void) => {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === preferenceKey) {
          preferences.delete(preferenceKey)
          onChange()
        }
      }
      window.addEventListener("storage", handleStorage)
      window.addEventListener(PREFERENCE_EVENT, onChange)
      return () => {
        window.removeEventListener("storage", handleStorage)
        window.removeEventListener(PREFERENCE_EVENT, onChange)
      }
    },
    [preferenceKey]
  )
  const getSnapshot = useCallback(
    () => Boolean(currentUserId) && readPreference(preferenceKey),
    [currentUserId, preferenceKey]
  )
  const getServerSnapshot = useCallback(
    () => Boolean(currentUserId),
    [currentUserId]
  )
  const notificationSoundEnabled = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  useEffect(() => {
    if (!currentUserId) return

    let context: AudioContext | null = null
    let disposed = false
    let lastPlayedAt = -Infinity
    const claimKey = `deal-hay:notification-sound-events:${currentUserId}`

    const unlock = () => {
      if (disposed || !readPreference(preferenceKey)) return
      try {
        if (!context || context.state === "closed") {
          if (typeof window.AudioContext !== "function") return
          context = new window.AudioContext()
        }
        if (context.state !== "running") void context.resume().catch(() => {})
      } catch {
        // Sound availability must never interrupt navigation or chat delivery.
      }
    }

    const play = (eventId: string) => {
      const playOnce = () => {
        if (
          disposed ||
          !readPreference(preferenceKey) ||
          context?.state !== "running"
        ) {
          return
        }
        if (!claimSound(claimKey, eventId)) return
        if (performance.now() - lastPlayedAt < 1000) return

        try {
          playChime(context)
          lastPlayedAt = performance.now()
        } catch {
          // An unsupported or blocked audio device leaves visual alerts intact.
        }
      }

      if (disposed || context?.state !== "running") return
      if (navigator.locks?.request) {
        void navigator.locks
          .request(claimKey, { ifAvailable: true }, (lock) => {
            if (lock) playOnce()
          })
          .catch(() => playOnce())
      } else {
        playOnce()
      }
    }

    player.current = { unlock, play }
    document.addEventListener("pointerdown", unlock, true)
    document.addEventListener("keydown", unlock, true)
    return () => {
      disposed = true
      player.current = null
      document.removeEventListener("pointerdown", unlock, true)
      document.removeEventListener("keydown", unlock, true)
      if (context && context.state !== "closed") {
        void context.close().catch(() => {})
      }
    }
  }, [currentUserId, preferenceKey])

  const toggleNotificationSound = useCallback(() => {
    if (!currentUserId) return
    const enabled = !readPreference(preferenceKey)
    try {
      window.localStorage.setItem(preferenceKey, enabled ? "enabled" : "muted")
      preferences.delete(preferenceKey)
    } catch {
      preferences.set(preferenceKey, enabled)
      // Keep the preference for this tab when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(PREFERENCE_EVENT))
    if (enabled) player.current?.unlock()
  }, [currentUserId, preferenceKey])

  const playNotificationSound = useCallback((eventId: string) => {
    player.current?.play(eventId)
  }, [])

  return {
    notificationSoundEnabled,
    toggleNotificationSound,
    playNotificationSound,
  }
}
