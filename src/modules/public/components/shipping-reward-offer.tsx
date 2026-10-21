"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { PlayIcon, RefreshCwIcon, TicketPercentIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getAuthPageHref } from "@/lib/auth-redirect"
import { ShippingAdvertisement } from "@/modules/public/components/shipping-advertisement"
import {
  loadShippingOfferAction,
  redeemShippingRewardAction,
  startShippingRewardViewAction,
} from "@/modules/public/shipping-reward-actions"
import type {
  ShippingDiscountCode,
  ShippingOffer,
  ShippingRewardView,
} from "@/types/shipping-reward"

export function ShippingRewardOffer({
  shopCode,
  productSlug,
  code,
  disabled,
  onCodeReceived,
  onRedeemingChange,
}: {
  shopCode: string
  productSlug: string
  code: ShippingDiscountCode | null
  disabled: boolean
  onCodeReceived: (code: ShippingDiscountCode) => void
  onRedeemingChange: (pending: boolean) => void
}) {
  const [offer, setOffer] = useState<ShippingOffer | null>(null)
  const [view, setView] = useState<ShippingRewardView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, startLoading] = useTransition()
  const [redeeming, startRedeeming] = useTransition()
  const redeemingRef = useRef(false)
  const [reload, setReload] = useState(0)
  const hasCode = Boolean(code?.is_available && !code.used_at)

  useEffect(() => {
    let active = true
    startLoading(async () => {
      setError(null)
      setView(null)
      const result = await loadShippingOfferAction(shopCode, productSlug)
      if (!active) return
      setOffer(result.success && result.data ? result.data : null)
      if (!result.success || !result.data) {
        setError(result.message)
        return
      }
      if (!result.data.available || hasCode) return
      const session = await startShippingRewardViewAction(shopCode, productSlug)
      if (!active) return
      if (session.success && session.data) setView(session.data)
      else setError(session.message)
    })
    return () => {
      active = false
    }
  }, [shopCode, productSlug, reload, hasCode])

  function redeem() {
    if (
      !view ||
      !ready ||
      disabled ||
      redeemingRef.current ||
      redeeming ||
      hasCode
    )
      return
    if (Date.parse(view.expires_at) <= Date.now()) {
      setError("Phiên quảng cáo đã hết hạn. Vui lòng tải lại để tiếp tục.")
      setView(null)
      return
    }
    redeemingRef.current = true
    onRedeemingChange(true)
    startRedeeming(async () => {
      try {
        const result = await redeemShippingRewardAction(
          shopCode,
          productSlug,
          view.id
        )
        if (!result.success || !result.data) {
          setError(result.message)
          return
        }
        if (
          !result.data.is_available ||
          result.data.used_at ||
          Date.parse(result.data.expires_at) <= Date.now()
        ) {
          setError(
            "Mã của phiên này đã hết hạn hoặc đã được dùng. Vui lòng tải lại để nhận mã mới."
          )
          setView(null)
          return
        }
        setError(null)
        onCodeReceived(result.data)
      } finally {
        redeemingRef.current = false
        onRedeemingChange(false)
      }
    })
  }

  return (
    <section
      aria-label="Nhận mã miễn phí vận chuyển"
      className="space-y-3 rounded-lg border bg-muted/30 p-4"
    >
      <h3 className="flex items-center gap-2 font-medium">
        <TicketPercentIcon className="size-4" /> Miễn phí vận chuyển
      </h3>
      {hasCode ? (
        <p role="status" className="text-sm text-primary">
          Đã lưu mã {code?.code}. Mã được áp dụng vào phí giao hàng tại Hà Nội
          khi shop có báo phí.
        </p>
      ) : loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Đang chuẩn bị quảng cáo...
        </p>
      ) : offer && !offer.available ? (
        <p className="text-sm text-muted-foreground">
          {offer.unavailable_reason === "shipping_not_configured"
            ? "Shop chưa bật phí giao hàng tại Hà Nội. Chưa thể đổi mã vận chuyển."
            : "Chương trình đổi mã vận chuyển hiện chưa được bật."}
        </p>
      ) : null}
      {offer?.available && !hasCode ? (
        <>
          <p className="text-sm text-muted-foreground">
            Bấm “Xem” bên dưới để đổi mã giảm 100% phí vận chuyển tại Hà Nội.
            Mỗi mã dùng cho một đơn hàng của sản phẩm này.
          </p>
          <ShippingAdvertisement onReadyChange={setReady} />
          <Button
            type="button"
            className="w-full"
            onClick={redeem}
            disabled={disabled || loading || redeeming || !view || !ready}
          >
            <PlayIcon /> {redeeming ? "Đang đổi mã..." : "Xem"}
          </Button>
        </>
      ) : null}
      {error ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          {error.includes("đăng nhập") ? (
            <Link
              className="text-sm text-primary underline"
              href={getAuthPageHref(
                "/sign-in",
                `/shops/${encodeURIComponent(shopCode)}/products/${encodeURIComponent(productSlug)}`
              )}
            >
              Đăng nhập để nhận mã
            </Link>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || loading || redeeming}
              onClick={() => setReload((value) => value + 1)}
            >
              <RefreshCwIcon /> Tải lại quảng cáo
            </Button>
          )}
        </div>
      ) : null}
    </section>
  )
}
