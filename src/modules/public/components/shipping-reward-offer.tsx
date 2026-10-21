"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { PlayIcon, RefreshCwIcon, TicketPercentIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getAuthPageHref } from "@/lib/auth-redirect"
import { readAdvertisingConsent } from "@/lib/advertising-consent"
import {
  requestGoogleRewardedAd,
  type RewardedAdController,
} from "@/lib/google-rewarded-ads"
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
  onAdVisibleChange,
}: {
  shopCode: string
  productSlug: string
  code: ShippingDiscountCode | null
  disabled: boolean
  onCodeReceived: (code: ShippingDiscountCode) => void
  onRedeemingChange: (pending: boolean) => void
  onAdVisibleChange: (visible: boolean) => void
}) {
  const [offer, setOffer] = useState<ShippingOffer | null>(null)
  const [earnedView, setEarnedView] = useState<ShippingRewardView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [watching, setWatching] = useState(false)
  const [loading, startLoading] = useTransition()
  const [redeeming, startRedeeming] = useTransition()
  const watchingRef = useRef(false)
  const redeemingRef = useRef(false)
  const controller = useRef<RewardedAdController | null>(null)
  const generation = useRef(0)
  const attempt = useRef(0)
  const [reload, setReload] = useState(0)
  const hasCode = Boolean(code?.is_available && !code.used_at)

  useEffect(() => {
    onRedeemingChange(watching || redeeming)
  }, [watching, redeeming, onRedeemingChange])

  useEffect(() => {
    const current = ++generation.current
    startLoading(async () => {
      setError(null)
      setEarnedView(null)
      setOffer(null)
      setWatching(false)
      const result = await loadShippingOfferAction(shopCode, productSlug)
      if (current !== generation.current) return
      setOffer(result.success && result.data ? result.data : null)
      if (!result.success || !result.data) setError(result.message)
    })
    return () => {
      generation.current += 1
      attempt.current += 1
      controller.current?.destroy()
      controller.current = null
      watchingRef.current = false
      onRedeemingChange(false)
      onAdVisibleChange(false)
    }
  }, [shopCode, productSlug, reload, onRedeemingChange, onAdVisibleChange])

  const onConsentChange = useCallback(
    (accepted: boolean) => {
      setConsent(accepted)
      if (!accepted) {
        attempt.current += 1
        controller.current?.destroy()
        controller.current = null
        watchingRef.current = false
        setWatching(false)
        onAdVisibleChange(false)
      }
    },
    [onAdVisibleChange]
  )

  function redeem(view: ShippingRewardView) {
    if (disabled || redeemingRef.current || hasCode) return
    const expiresAt = Date.parse(view.expires_at)
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      setError("Phiên quảng cáo đã hết hạn. Vui lòng tải lại để tiếp tục.")
      setEarnedView(null)
      return
    }
    const current = generation.current
    redeemingRef.current = true
    startRedeeming(async () => {
      try {
        const result = await redeemShippingRewardAction(
          shopCode,
          productSlug,
          view.id
        )
        if (current !== generation.current) return
        if (!result.success || !result.data) {
          setError(result.message)
          return
        }
        const codeExpiresAt = Date.parse(result.data.expires_at)
        if (
          !result.data.is_available ||
          result.data.used_at ||
          !Number.isFinite(codeExpiresAt) ||
          codeExpiresAt <= Date.now()
        ) {
          setError(
            "Mã của phiên này đã hết hạn hoặc đã được dùng. Vui lòng tải lại để nhận mã mới."
          )
          setEarnedView(null)
          return
        }
        setError(null)
        onCodeReceived(result.data)
      } catch {
        if (current === generation.current)
          setError("Chưa nhận được mã vận chuyển. Vui lòng thử nhận lại mã.")
      } finally {
        redeemingRef.current = false
      }
    })
  }

  async function watch() {
    if (
      disabled ||
      loading ||
      watchingRef.current ||
      redeemingRef.current ||
      hasCode ||
      !offer?.available ||
      !offer.rewarded_ad_unit_path ||
      readAdvertisingConsent(document.cookie) !== "accepted"
    )
      return

    const current = generation.current
    const currentAttempt = ++attempt.current
    const isCurrent = () =>
      current === generation.current && currentAttempt === attempt.current
    watchingRef.current = true
    setWatching(true)
    setError(null)
    setEarnedView(null)
    controller.current?.destroy()
    controller.current = null
    try {
      const session = await startShippingRewardViewAction(shopCode, productSlug)
      if (!isCurrent()) return
      if (!session.success || !session.data) {
        watchingRef.current = false
        setWatching(false)
        setError(session.message)
        return
      }
      if (readAdvertisingConsent(document.cookie) !== "accepted") {
        watchingRef.current = false
        setWatching(false)
        return
      }
      const view = session.data
      if (
        !Number.isFinite(Date.parse(view.expires_at)) ||
        Date.parse(view.expires_at) <= Date.now()
      ) {
        watchingRef.current = false
        setWatching(false)
        setError("Phiên quảng cáo đã hết hạn. Vui lòng tải lại để tiếp tục.")
        return
      }
      controller.current = requestGoogleRewardedAd(view.rewarded_ad_unit_path, {
        onVisibleChange: onAdVisibleChange,
        onGranted: () => {
          if (!isCurrent()) return
          setEarnedView(view)
          setError(null)
          redeem(view)
        },
        onClosed: (granted) => {
          if (!isCurrent()) return
          watchingRef.current = false
          setWatching(false)
          if (!granted)
            setError(
              "Bạn đã đóng quảng cáo khi chưa nhận được phần thưởng. Bạn có thể thử lại hoặc tiếp tục đặt hàng."
            )
        },
        onError: (message) => {
          if (!isCurrent()) return
          watchingRef.current = false
          setWatching(false)
          setError(message)
        },
      })
    } catch {
      if (!isCurrent()) return
      watchingRef.current = false
      setWatching(false)
      setError("Không mở được quảng cáo. Vui lòng thử lại sau.")
    }
  }

  function cancelWatch() {
    attempt.current += 1
    controller.current?.destroy()
    controller.current = null
    watchingRef.current = false
    setWatching(false)
    setError(null)
    onAdVisibleChange(false)
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
          Đang kiểm tra ưu đãi vận chuyển...
        </p>
      ) : offer && !offer.available ? (
        <p className="text-sm text-muted-foreground">
          {offer.unavailable_reason === "shipping_not_configured"
            ? "Shop chưa bật phí giao hàng tại Hà Nội. Chưa thể đổi mã vận chuyển."
            : "Ưu đãi quảng cáo miễn phí vận chuyển hiện chưa khả dụng. Bạn vẫn có thể tiếp tục đặt hàng."}
        </p>
      ) : null}
      {offer?.available && !hasCode ? (
        <>
          <p className="text-sm text-muted-foreground">
            Chọn xem một quảng cáo có thưởng để nhận mã giảm 100% phí vận chuyển
            tại Hà Nội khi đạt điều kiện. Mỗi mã dùng một lần cho sản phẩm này,
            trên tài khoản của bạn.
          </p>
          <ShippingAdvertisement onConsentChange={onConsentChange} />
          <Button
            type="button"
            className="w-full"
            onClick={() => (earnedView ? redeem(earnedView) : void watch())}
            disabled={
              disabled ||
              loading ||
              redeeming ||
              watching ||
              (!earnedView && !consent)
            }
          >
            <PlayIcon />{" "}
            {redeeming
              ? "Đang nhận mã..."
              : watching
                ? "Đang mở hoặc xem quảng cáo..."
                : earnedView
                  ? "Nhận lại mã miễn ship"
                  : "Xem quảng cáo để nhận mã miễn ship"}
          </Button>
          {watching && !redeeming ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={cancelWatch}
            >
              Hủy xem quảng cáo
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Bạn có thể bỏ qua quảng cáo và đặt hàng với phí vận chuyển thông
            thường.
          </p>
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
          ) : !watching && !earnedView ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || loading || redeeming}
              onClick={() => setReload((value) => value + 1)}
            >
              <RefreshCwIcon /> Tải lại ưu đãi
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
