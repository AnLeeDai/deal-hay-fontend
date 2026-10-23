"use client"

import { useEffect, useId, useState } from "react"
import Link from "next/link"
import { CopyIcon, TicketPercentIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { formatCurrency, formatDate } from "@/lib/format"
import { loadShopOffersAction } from "@/modules/public/shop-offer-actions"
import { shopOfferDiscount } from "@/modules/public/lib/shop-offers"
import type { ShopOffer } from "@/types/shop-coupon"

function offerValue(offer: ShopOffer): string {
  return offer.discount_type === "percent"
    ? `${offer.discount_value}%`
    : formatCurrency(offer.discount_value)
}

export function ShopOffers({ shopCode }: { shopCode: string }) {
  const [result, setResult] = useState<{
    offers: ShopOffer[]
    error?: string
  } | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    loadShopOffersAction(shopCode)
      .then((response) => {
        if (active)
          setResult({
            offers: response.data ?? [],
            error: response.success ? undefined : response.message,
          })
      })
      .catch(() => {
        if (active)
          setResult({ offers: [], error: "Không tải được ưu đãi từ shop." })
      })
    return () => {
      active = false
    }
  }, [shopCode, reload])

  return (
    <section className="space-y-4" aria-labelledby="shop-offers-heading">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <TicketPercentIcon className="size-5" />
        </span>
        <div>
          <h2 id="shop-offers-heading" className="text-2xl font-semibold">
            Ưu đãi từ shop
          </h2>
          <p className="text-sm text-muted-foreground">
            Chọn sản phẩm trong ưu đãi và áp dụng mã khi đặt hàng.
          </p>
        </div>
      </div>
      {!result ? (
        <p className="text-sm text-muted-foreground" role="status">
          Đang tải ưu đãi...
        </p>
      ) : result.error ? (
        <div className="flex items-center gap-3 text-sm">
          <p role="alert">{result.error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReload((value) => value + 1)}
          >
            Thử lại
          </Button>
        </div>
      ) : result.offers.length === 0 ? (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          Shop chưa có ưu đãi đang áp dụng.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.offers.map((offer) => (
            <article
              key={offer.id}
              className="space-y-3 rounded-xl border bg-card p-5"
            >
              <div>
                <p className="text-xl font-semibold text-primary">
                  Giảm {offerValue(offer)}
                </p>
                <h3 className="mt-1 font-medium">{offer.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Tiền hàng từ {formatCurrency(offer.minimum_order_amount)}
                {offer.maximum_discount_amount !== null
                  ? ` · Tối đa ${formatCurrency(offer.maximum_discount_amount)}`
                  : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {offer.ends_at
                  ? `Hạn ${formatDate(offer.ends_at)}`
                  : "Không giới hạn thời gian"}
                {offer.remaining_uses !== null
                  ? ` · Còn ${offer.remaining_uses} lượt`
                  : ""}
              </p>
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Sản phẩm áp dụng
                </p>
                <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                  {offer.products.map((product) => (
                    <Link
                      key={product.id}
                      className="rounded-lg border px-2 py-1 text-xs hover:border-primary hover:text-primary"
                      href={`/shops/${encodeURIComponent(shopCode)}/products/${encodeURIComponent(product.slug)}`}
                    >
                      {product.name}
                    </Link>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                className="w-full"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(offer.code)
                    toast.success(
                      "Đã sao chép mã. Chọn ưu đãi này ở bước đặt hàng."
                    )
                  } catch {
                    toast.error(
                      "Không sao chép được mã. Bạn có thể chọn ưu đãi trực tiếp khi đặt hàng."
                    )
                  }
                }}
              >
                <CopyIcon />
                Sao chép mã ưu đãi
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function ShopOfferSelector({
  offers,
  subtotal,
  remaining,
  selectedId,
  onSelect,
  pending,
  error,
  onReload,
  disabled,
}: {
  offers: ShopOffer[]
  subtotal: number
  remaining: number
  selectedId: string
  onSelect: (id: string) => void
  pending: boolean
  error: string | null
  onReload: () => void
  disabled: boolean
}) {
  const prefix = useId()

  return (
    <fieldset className="space-y-3 rounded-xl border p-4" disabled={disabled}>
      <legend id={`${prefix}-legend`} className="px-1 font-medium">
        Ưu đãi từ shop
      </legend>
      <p className="text-xs leading-5 text-muted-foreground">
        Chọn một ưu đãi cho sản phẩm này. Mức giảm được tính trên tiền hàng còn
        lại sau các mã khác.
      </p>
      {pending ? (
        <p className="text-sm text-muted-foreground" role="status">
          Đang tải ưu đãi từ shop...
        </p>
      ) : null}
      {error ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReload}
            disabled={disabled}
          >
            Tải lại ưu đãi
          </Button>
        </div>
      ) : null}
      <RadioGroup
        aria-labelledby={`${prefix}-legend`}
        name="shop_offer"
        value={selectedId}
        onValueChange={(value) => onSelect(value)}
        disabled={disabled}
      >
        <Label
          htmlFor={`${prefix}-none`}
          className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-normal"
        >
          <RadioGroupItem id={`${prefix}-none`} value="" />
          Không dùng ưu đãi từ shop
        </Label>
        {offers.map((offer) => {
          const discount = shopOfferDiscount(offer, subtotal, remaining)
          return (
            <Label
              key={offer.id}
              htmlFor={`${prefix}-${offer.id}`}
              className={`flex items-start gap-3 rounded-lg border p-3 ${discount > 0 ? "cursor-pointer hover:border-primary" : "text-muted-foreground"}`}
            >
              <RadioGroupItem
                id={`${prefix}-${offer.id}`}
                className="mt-1"
                value={offer.id}
                disabled={pending || discount <= 0}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {offer.name} · Giảm {offerValue(offer)}
                </span>
                <span className="mt-1 block text-xs">
                  Tiền hàng từ {formatCurrency(offer.minimum_order_amount)}
                  {offer.maximum_discount_amount !== null
                    ? ` · Tối đa ${formatCurrency(offer.maximum_discount_amount)}`
                    : ""}
                </span>
                {offer.ends_at ? (
                  <span className="mt-1 block text-xs">
                    Hạn {formatDate(offer.ends_at)}
                  </span>
                ) : null}
                <span
                  className={`mt-1 block text-xs ${discount > 0 ? "text-primary" : ""}`}
                >
                  {discount > 0
                    ? `Tiết kiệm thêm ${formatCurrency(discount)}`
                    : subtotal < offer.minimum_order_amount
                      ? `Cần thêm ${formatCurrency(offer.minimum_order_amount - subtotal)} tiền hàng`
                      : "Chưa đủ điều kiện hoặc mã đã hết hiệu lực"}
                </span>
              </span>
            </Label>
          )
        })}
      </RadioGroup>
      {!pending && !error && !offers.length ? (
        <p className="text-sm text-muted-foreground">
          Sản phẩm này chưa có ưu đãi từ shop.
        </p>
      ) : null}
    </fieldset>
  )
}
