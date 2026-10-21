"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { ADSTERRA_NATIVE_BANNER_CONTAINER_ID } from "@/config/advertising"
import {
  ADVERTISING_CONSENT_CHANGE_EVENT,
  readAdvertisingConsent,
  serializeAdvertisingConsent,
  type AdvertisingConsent,
} from "@/lib/advertising-consent"

function moveBanner(
  parent: HTMLElement,
  banner: HTMLElement,
  before: Node | null
) {
  // Modern browsers preserve iframe state during an atomic DOM move.
  const destination = parent as HTMLElement & {
    moveBefore?: (node: Node, before: Node | null) => void
  }
  if (typeof destination.moveBefore === "function")
    destination.moveBefore(banner, before)
  else parent.insertBefore(banner, before)
}

export function ShippingAdvertisement({
  onReadyChange,
}: {
  onReadyChange: (ready: boolean) => void
}) {
  const slot = useRef<HTMLDivElement>(null)
  const onReadyChangeRef = useRef(onReadyChange)
  const [consent, setConsent] = useState<AdvertisingConsent | null>(null)
  const [ready, setReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useLayoutEffect(() => {
    onReadyChangeRef.current = onReadyChange
  }, [onReadyChange])

  useLayoutEffect(() => {
    const destination = slot.current
    if (!destination) return

    let banner: HTMLElement | null = null
    let originalParent: HTMLElement | null = null
    let originalNextSibling: Node | null = null
    let lastReady = false
    let lastConsent: AdvertisingConsent | null | undefined

    function reportReady(value: boolean) {
      if (lastReady === value) return
      lastReady = value
      setReady(value)
      onReadyChangeRef.current(value)
    }

    function restoreBanner() {
      if (banner && originalParent?.isConnected) {
        moveBanner(
          originalParent,
          banner,
          originalNextSibling?.parentNode === originalParent
            ? originalNextSibling
            : null
        )
      }
      banner = null
      originalParent = null
      originalNextSibling = null
    }

    function syncAdvertisement() {
      const currentConsent = readAdvertisingConsent(document.cookie)
      if (lastConsent !== currentConsent) {
        lastConsent = currentConsent
        setConsent(currentConsent)
        setTimedOut(false)
      }
      if (currentConsent !== "accepted") {
        restoreBanner()
        reportReady(false)
        return
      }

      const existing = document.getElementById(
        ADSTERRA_NATIVE_BANNER_CONTAINER_ID
      )
      // Let the storefront place its singleton script beside the original
      // container before moving it; otherwise accepting consent could leave
      // that script inside this temporary slot when the dialog closes.
      const initialized = document.getElementById("adsterra-native-banner")
      if (existing && initialized && existing !== banner) {
        restoreBanner()
        banner = existing
        originalParent = existing.parentElement
        originalNextSibling = existing.nextSibling
        moveBanner(destination!, existing, null)
      }
      reportReady(
        Boolean(
          banner?.isConnected &&
          banner.parentElement === destination &&
          banner.querySelector(
            'iframe[src]:not([src=""]), a[href]:not([href=""]), img[src]:not([src=""])'
          )
        )
      )
    }

    // Only borrow the already configured placement. The storefront owns all
    // provider initialization and consent; this slot never adds a script.
    const observer = new MutationObserver(syncAdvertisement)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "href"],
    })
    window.addEventListener(ADVERTISING_CONSENT_CHANGE_EVENT, syncAdvertisement)
    window.addEventListener("focus", syncAdvertisement)
    window.addEventListener("pageshow", syncAdvertisement)
    document.addEventListener("visibilitychange", syncAdvertisement)
    onReadyChangeRef.current(false)
    syncAdvertisement()

    return () => {
      observer.disconnect()
      window.removeEventListener(
        ADVERTISING_CONSENT_CHANGE_EVENT,
        syncAdvertisement
      )
      window.removeEventListener("focus", syncAdvertisement)
      window.removeEventListener("pageshow", syncAdvertisement)
      document.removeEventListener("visibilitychange", syncAdvertisement)
      // A layout cleanup restores React's original parent before this slot
      // is removed, including when the order dialog closes.
      restoreBanner()
      onReadyChangeRef.current(false)
    }
  }, [])

  useEffect(() => {
    if (consent !== "accepted") return
    const timeout = window.setTimeout(() => setTimedOut(true), 12_000)
    return () => window.clearTimeout(timeout)
  }, [consent])

  function saveConsent(choice: AdvertisingConsent) {
    document.cookie = serializeAdvertisingConsent(
      choice,
      window.location.protocol === "https:"
    )
    window.dispatchEvent(new Event(ADVERTISING_CONSENT_CHANGE_EVENT))
  }

  return (
    <section aria-label="Quảng cáo Adsterra" className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase">
        Quảng cáo đối tác
      </p>
      {consent !== "accepted" ? (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm leading-6 text-muted-foreground">
            Để tải quảng cáo Adsterra, bạn cần đồng ý cookie quảng cáo. Adsterra
            và đối tác có thể dùng cookie, địa chỉ IP và thông tin trình duyệt
            để phân phối và đo lường quảng cáo. Xem{" "}
            <a href="/privacy" className="text-primary underline">
              Chính sách bảo mật
            </a>
            .
          </p>
          {consent === "declined" ? (
            <p className="text-sm text-muted-foreground">
              Bạn đang chỉ sử dụng cookie cần thiết.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => saveConsent("declined")}
            >
              Chỉ dùng cookie cần thiết
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => saveConsent("accepted")}
            >
              Đồng ý cookie quảng cáo
            </Button>
          </div>
        </div>
      ) : null}
      <div
        ref={slot}
        className={consent === "accepted" ? "min-h-32" : "hidden"}
      />
      {consent === "accepted" && !ready ? (
        <p role="status" className="text-sm text-muted-foreground">
          {timedOut
            ? "Quảng cáo hiện chưa khả dụng. Vui lòng thử lại sau hoặc kiểm tra trình chặn quảng cáo."
            : "Đang tải quảng cáo…"}
        </p>
      ) : null}
    </section>
  )
}
