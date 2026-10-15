"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { MessageCircleIcon, PlayIcon, ShoppingBagIcon } from "lucide-react"
import { toast } from "sonner"

import { AddressFields } from "@/components/address-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ProductGallery } from "@/modules/public/components/product-gallery"
import {
  completeProductAdvertisementAction,
  orderProductAction,
  startProductAdvertisementAction,
} from "@/modules/public/actions"
import {
  checkoutSchema,
  type CheckoutValues,
} from "@/modules/public/schemas/checkout"
import { applyServerErrors } from "@/lib/form-utils"
import { formatCurrency } from "@/lib/format"
import type {
  PublicProduct,
  PublicProductVariant,
  PublicShop,
} from "@/types/catalog"

export function ProductOrderDialog({
  open,
  onOpenChange,
  shop,
  product,
  variant,
  salePrice,
  regularPrice,
  stock,
  onMessage,
  messagePending,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  shop: PublicShop
  product: PublicProduct
  variant?: PublicProductVariant
  salePrice: number
  regularPrice: number
  stock: number
  onMessage: () => void
  messagePending: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [checkout, setCheckout] = useState(false)
  const [ad, setAd] = useState<{
    id: string
    video_url: string
    duration_seconds: number
  } | null>(null)
  const [rewardId, setRewardId] = useState<string | null>(null)
  const [adError, setAdError] = useState(false)
  const [adEnded, setAdEnded] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID()
  )
  const watchedThrough = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customer_name: "",
      customer_phone: "",
      shipping_address: "",
      shipping_province_code: "",
      shipping_ward_code: "",
      quantity: 1,
      note: "",
    },
  })
  const quantity = useWatch({ control: form.control, name: "quantity" }) || 1

  const viewAdvertisement = () => {
    startTransition(async () => {
      const state = await startProductAdvertisementAction(
        shop.code,
        product.slug
      )
      if (!state.success || !state.data) {
        toast.error(state.message)
        return
      }
      watchedThrough.current = 0
      setAdError(false)
      setAdEnded(false)
      setRewardId(null)
      setCheckout(false)
      setAd(state.data)
    })
  }

  const finishAdvertisement = () => {
    if (!ad || adError) return
    startTransition(async () => {
      const state = await completeProductAdvertisementAction(
        shop.code,
        product.slug,
        ad.id
      )
      if (!state.success) {
        setAdEnded(true)
        toast.error(state.message)
        return
      }
      setRewardId(ad.id)
      setAd(null)
      setCheckout(true)
      toast.success(state.message)
    })
  }

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const state = await orderProductAction(
        shop.code,
        product.slug,
        {
          ...values,
          variant_id: variant?.id,
          advertisement_view_id: rewardId ?? undefined,
        },
        idempotencyKey
      )
      if (!state.success || !state.data) {
        const hasErrors = applyServerErrors(state.errors, form.setError)
        if (
          !hasErrors ||
          state.errors?.advertisement_view_id ||
          state.errors?.variant_id
        )
          toast.error(
            state.errors?.advertisement_view_id?.[0] ||
              state.errors?.variant_id?.[0] ||
              state.message
          )
        return
      }
      toast.success(
        `${state.message} Mã đơn: ${state.data.order_number}. Tổng: ${formatCurrency(state.data.total)}`
      )
      setRewardId(null)
      setCheckout(false)
      form.reset()
      setIdempotencyKey(crypto.randomUUID())
      onOpenChange(false)
      router.refresh()
    })
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          onOpenChange(value)
          if (!value) setAd(null)
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            {ad ? (
              <div className="space-y-3">
                <p className="font-medium">Xem hết video để nhận ưu đãi</p>
                <video
                  key={ad.id}
                  ref={videoRef}
                  autoPlay
                  playsInline
                  controls
                  controlsList="nodownload noplaybackrate"
                  disablePictureInPicture
                  className="aspect-video w-full rounded-lg bg-black"
                  src={ad.video_url}
                  onRateChange={() => {
                    if (videoRef.current) videoRef.current.playbackRate = 1
                  }}
                  onSeeking={(event) => {
                    if (
                      event.currentTarget.currentTime >
                      watchedThrough.current + 1
                    )
                      event.currentTarget.currentTime = watchedThrough.current
                  }}
                  onTimeUpdate={(event) => {
                    if (
                      !event.currentTarget.seeking &&
                      !event.currentTarget.paused
                    )
                      watchedThrough.current = Math.max(
                        watchedThrough.current,
                        event.currentTarget.currentTime
                      )
                  }}
                  onEnded={finishAdvertisement}
                  onError={() => {
                    setAdError(true)
                    toast.error(
                      "Không tải được quảng cáo. Bạn vẫn có thể đặt hàng theo giá gốc."
                    )
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Ưu đãi được mở khi video kết thúc và hệ thống xác nhận đủ thời
                  gian xem.
                </p>
                {adEnded ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Video đã kết thúc. Hãy xác nhận lại sau khi đủ thời lượng
                      quảng cáo do cửa hàng cung cấp.
                    </p>
                    <Button disabled={pending} onClick={finishAdvertisement}>
                      Xác nhận đã xem hết
                    </Button>
                  </div>
                ) : null}
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setAd(null)}
                >
                  Quay lại đặt hàng
                </Button>
              </div>
            ) : (
              <ProductGallery
                name={product.name}
                imageUrl={product.image_url}
                images={product.images}
                videoUrl={product.video_url}
              />
            )}
          </div>
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="pr-6 text-xl">{product.name}</DialogTitle>
              <DialogDescription>
                {product.description || "Cửa hàng chưa bổ sung mô tả sản phẩm."}
              </DialogDescription>
            </DialogHeader>
            <p>
              Người bán:{" "}
              <Link
                href={`/shops/${shop.code}`}
                className="font-medium text-primary"
              >
                {shop.name}
              </Link>
            </p>
            {variant ? (
              <p className="text-sm text-muted-foreground">
                {variant.variant_label ||
                  Object.values(variant.option_values).join(" · ") ||
                  variant.sku}
              </p>
            ) : null}
            {regularPrice > salePrice && product.advertisement_available ? (
              <div>
                <p className="text-sm text-muted-foreground line-through">
                  {formatCurrency(regularPrice)}
                </p>
                <p className="text-2xl font-semibold text-primary">
                  {formatCurrency(salePrice)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Giá sau khi xem hết quảng cáo
                </p>
              </div>
            ) : (
              <p className="text-2xl font-semibold text-primary">
                {formatCurrency(regularPrice)}
              </p>
            )}
            <div className="space-y-3">
              <Button
                className="w-full"
                variant="outline"
                onClick={onMessage}
                disabled={pending || messagePending}
              >
                <MessageCircleIcon /> Nhắn với shop
              </Button>
              <Button
                className="w-full"
                disabled={pending || stock < 1 || Boolean(ad)}
                onClick={() => {
                  setRewardId(null)
                  setCheckout(true)
                }}
              >
                <ShoppingBagIcon /> Đặt ngay · {formatCurrency(regularPrice)}
              </Button>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Xem quảng cáo để nhận ngay ưu đãi
                </p>
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={
                    pending ||
                    !product.advertisement_available ||
                    stock < 1 ||
                    Boolean(ad)
                  }
                  onClick={viewAdvertisement}
                >
                  <PlayIcon /> Xem quảng cáo
                </Button>
              </div>
              {!product.advertisement_available ? (
                <p className="text-xs text-muted-foreground">
                  Sản phẩm hiện chưa có quảng cáo nhận ưu đãi.
                </p>
              ) : null}
            </div>
            {checkout ? (
              <Form {...form}>
                <form onSubmit={submit} className="space-y-4 border-t pt-4">
                  <p className="font-medium">Thông tin giao hàng</p>
                  {(
                    [
                      ["customer_name", "Tên người nhận"],
                      ["customer_phone", "Số điện thoại"],
                    ] as const
                  ).map(([name, label]) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              autoComplete={
                                name === "customer_phone" ? "tel" : "name"
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  <AddressFields
                    form={form}
                    provinceName="shipping_province_code"
                    wardName="shipping_ward_code"
                    valueMode="code"
                  />
                  <FormField
                    control={form.control}
                    name="shipping_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số nhà, tên đường</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="street-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số lượng</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            max={stock}
                            onChange={(event) =>
                              field.onChange(Number(event.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ghi chú</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p aria-live="polite" className="font-semibold">
                    Tổng thanh toán:{" "}
                    {formatCurrency(
                      (rewardId ? salePrice : regularPrice) * quantity
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rewardId
                      ? "Đã mở ưu đãi sau khi xem quảng cáo, áp dụng cho một đơn hàng."
                      : "Đặt ngay áp dụng giá gốc, chưa có ưu đãi quảng cáo."}
                  </p>
                  <Button type="submit" className="w-full" disabled={pending}>
                    {pending ? "Đang xử lý..." : "Xác nhận đặt hàng"}
                  </Button>
                </form>
              </Form>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
