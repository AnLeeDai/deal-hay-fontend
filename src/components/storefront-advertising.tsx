"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { ADSTERRA_NATIVE_BANNER_CONTAINER_ID } from "@/config/advertising"
import { initializeAdsterra } from "@/lib/adsterra"
import {
  readAdvertisingConsent,
  serializeAdvertisingConsent,
  type AdvertisingConsent,
} from "@/lib/advertising-consent"

export function StorefrontAdvertising({
  initialConsent,
}: {
  initialConsent: AdvertisingConsent | null
}) {
  const [consent, setConsent] = useState(initialConsent)
  const [showChoices, setShowChoices] = useState(initialConsent === null)
  const nativeContainer = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    let reloading = false

    function syncConsent() {
      // Cookies can change in another tab or while this document is cached.
      // Reloading also disposes provider listeners after a withdrawal.
      if (readAdvertisingConsent(document.cookie) !== consent) {
        if (!reloading) {
          reloading = true
          window.location.reload()
        }
        return false
      }
      return true
    }
    function syncWhenVisible() {
      if (document.visibilityState === "visible") syncConsent()
    }

    window.addEventListener("focus", syncConsent)
    window.addEventListener("pageshow", syncConsent)
    document.addEventListener("visibilitychange", syncWhenVisible)

    if (syncConsent() && consent === "accepted" && nativeContainer.current) {
      initializeAdsterra(nativeContainer.current)
      initialized.current = true
    }

    return () => {
      window.removeEventListener("focus", syncConsent)
      window.removeEventListener("pageshow", syncConsent)
      document.removeEventListener("visibilitychange", syncWhenVisible)
    }
  }, [consent])

  function saveConsent(choice: AdvertisingConsent) {
    document.cookie = serializeAdvertisingConsent(
      choice,
      window.location.protocol === "https:"
    )
    if (choice === "declined" && initialized.current) {
      // A fresh document also stops already-running provider code.
      window.location.reload()
      return
    }
    setConsent(choice)
    setShowChoices(false)
  }

  return (
    <>
      <aside
        aria-label="Quảng cáo đối tác"
        className="mt-10 space-y-4 border-t pt-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Quảng cáo
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowChoices(true)}
          >
            Tùy chọn cookie quảng cáo
          </Button>
        </div>
        {consent === "accepted" ? (
          <div
            id={ADSTERRA_NATIVE_BANNER_CONTAINER_ID}
            ref={nativeContainer}
            className="min-h-32"
          />
        ) : null}
      </aside>
      {showChoices ? (
        <section
          aria-label="Lựa chọn cookie quảng cáo"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl space-y-3 rounded-xl border bg-background p-4 shadow-lg sm:p-5"
        >
          <p className="font-medium">Cookie quảng cáo</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Adsterra và các đối tác có thể dùng cookie, địa chỉ IP và thông tin
            trình duyệt để phân phối và đo lường quảng cáo. Bạn có thể thay đổi
            lựa chọn bất cứ lúc nào tại Tùy chọn cookie quảng cáo. Xem{" "}
            <a className="text-primary underline" href="/privacy">
              Chính sách bảo mật
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => saveConsent("declined")}
            >
              Chỉ dùng cookie cần thiết
            </Button>
            <Button type="button" onClick={() => saveConsent("accepted")}>
              Đồng ý cookie quảng cáo
            </Button>
            {consent !== null ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowChoices(false)}
              >
                Đóng
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  )
}
