"use client"

import { useEffect, useRef, type RefObject } from "react"

export function useVisibleNotifications(
  container: RefObject<HTMLDivElement | null>,
  unreadIds: string[],
  onRead: (ids: string[]) => Promise<void>
) {
  const callback = useRef(onRead)
  useEffect(() => {
    callback.current = onRead
  }, [onRead])
  const idsKey = unreadIds.join(",")

  useEffect(() => {
    if (
      !container.current ||
      !idsKey ||
      typeof IntersectionObserver === "undefined"
    )
      return
    let disposed = false
    const visible = new Set<string>()
    const pending = new Set<string>()
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
    let flushTimer: ReturnType<typeof setTimeout> | undefined
    const isActive = () =>
      document.visibilityState === "visible" && document.hasFocus()
    const flush = () => {
      const ids = [...pending]
      pending.clear()
      if (ids.length && isActive())
        void callback.current(ids).catch(() => {
          if (!disposed) ids.forEach(schedule)
        })
    }
    const schedule = (id: string) => {
      if (timers.has(id) || !visible.has(id) || !isActive()) return
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id)
          if (!visible.has(id) || !isActive()) return
          pending.add(id)
          if (flushTimer) clearTimeout(flushTimer)
          flushTimer = setTimeout(flush, 100)
        }, 900)
      )
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.notificationId
          if (!id) continue
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            visible.add(id)
            schedule(id)
          } else {
            visible.delete(id)
            pending.delete(id)
            const timer = timers.get(id)
            if (timer) clearTimeout(timer)
            timers.delete(id)
          }
        }
      },
      { threshold: [0, 0.5] }
    )
    container.current
      .querySelectorAll('[data-unread="true"]')
      .forEach((element) => observer.observe(element))
    const onActivity = () => {
      if (isActive()) visible.forEach(schedule)
      else {
        timers.forEach(clearTimeout)
        timers.clear()
        pending.clear()
      }
    }
    document.addEventListener("visibilitychange", onActivity)
    window.addEventListener("focus", onActivity)
    window.addEventListener("blur", onActivity)
    return () => {
      disposed = true
      observer.disconnect()
      timers.forEach(clearTimeout)
      if (flushTimer) clearTimeout(flushTimer)
      document.removeEventListener("visibilitychange", onActivity)
      window.removeEventListener("focus", onActivity)
      window.removeEventListener("blur", onActivity)
    }
  }, [container, idsKey])
}
