"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  ADVERTISING_CONSENT_CHANGE_EVENT,
  readAdvertisingConsent,
  serializeAdvertisingConsent,
  type AdvertisingConsent,
} from "@/lib/advertising-consent"

export function ShippingAdvertisement({
  onConsentChange,
}: {
  onConsentChange: (accepted: boolean) => void
}) {
  const [consent, setConsent] = useState<AdvertisingConsent | null>(null)

  useEffect(() => {
    function syncConsent() {
      const choice = readAdvertisingConsent(document.cookie)
      setConsent(choice)
      onConsentChange(choice === "accepted")
    }
    syncConsent()
    window.addEventListener(ADVERTISING_CONSENT_CHANGE_EVENT, syncConsent)
    window.addEventListener("focus", syncConsent)
    window.addEventListener("pageshow", syncConsent)
    document.addEventListener("visibilitychange", syncConsent)
    return () => {
      window.removeEventListener(ADVERTISING_CONSENT_CHANGE_EVENT, syncConsent)
      window.removeEventListener("focus", syncConsent)
      window.removeEventListener("pageshow", syncConsent)
      document.removeEventListener("visibilitychange", syncConsent)
    }
  }, [onConsentChange])

  function saveConsent(choice: AdvertisingConsent) {
    document.cookie = serializeAdvertisingConsent(
      choice,
      window.location.protocol === "https:"
    )
    window.dispatchEvent(new Event(ADVERTISING_CONSENT_CHANGE_EVENT))
  }

  return (
    <section aria-label="Quảng cáo có thưởng Google" className="space-y-3">
      {consent === "accepted" ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Quảng cáo có thưởng do Google cung cấp. Bạn có thể đóng quảng cáo bất
          cứ lúc nào; đóng trước khi đạt điều kiện sẽ không nhận được mã.
        </p>
      ) : (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm leading-6 text-muted-foreground">
            Để tải quảng cáo có thưởng, bạn cần đồng ý cookie quảng cáo. Google
            và đối tác có thể dùng cookie, địa chỉ IP và thông tin trình duyệt
            để phân phối và đo lường quảng cáo. Xem{" "}
            <Link href="/privacy" className="text-primary underline">
              Chính sách bảo mật
            </Link>
            . Bạn vẫn có thể đặt hàng với phí vận chuyển thông thường nếu không
            xem quảng cáo.
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
      )}
    </section>
  )
}
