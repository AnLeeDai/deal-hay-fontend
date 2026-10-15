"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { MessageCircleIcon, PlayIcon, ShoppingBagIcon } from "lucide-react"
import { toast } from "sonner"

import { AddressFields } from "@/components/address-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  orderProductAction,
  startProductAdvertisementAction,
} from "@/modules/public/actions"
import {
  checkoutSchema,
  type CheckoutValues,
} from "@/modules/public/schemas/checkout"
import { applyServerErrors } from "@/lib/form-utils"
import { formatCurrency, formatDate } from "@/lib/format"
import { getAuthPageHref } from "@/lib/auth-redirect"
import { loadDiscountCodesAction } from "@/modules/discount-codes/actions"
import { summarizeDiscountCodes } from "@/modules/discount-codes/lib/discount-codes"
import { formatDiscountCodeValue } from "@/modules/discount-codes/lib/format-discount-code"
import type { ProductDiscountCode } from "@/types/discount-code"
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
  regularPrice,
  stock,
  onMessage,
  messagePending,
  initialDiscountCode,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  shop: PublicShop
  product: PublicProduct
  variant?: PublicProductVariant
  regularPrice: number
  stock: number
  onMessage: () => void
  messagePending: boolean
  initialDiscountCode?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [checkout, setCheckout] = useState(Boolean(initialDiscountCode))
  const [selectedCodes, setSelectedCodes] = useState<string[]>(
    initialDiscountCode ? [initialDiscountCode] : []
  )
  const [savedCodes, setSavedCodes] = useState<ProductDiscountCode[]>([])
  const [codesError, setCodesError] = useState<string | null>(null)
  const [codesPending, startCodesTransition] = useTransition()
  const [reloadCodes, setReloadCodes] = useState(0)
  const [adMessage, setAdMessage] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID()
  )
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
  const quantity = useWatch({ control: form.control, name: "quantity" }) ?? 1
  const validQuantity =
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= Math.min(stock, 9999)
  const discountCodes = savedCodes.filter(
    (code) => code.is_available && code.product.id === product.id
  )
  const selectedDiscountCodes = selectedCodes.flatMap((value) => {
    const code = discountCodes.find((item) => item.code === value)
    return code ? [code] : []
  })
  const unknownSelectedCodes = selectedCodes.filter(
    (value) => !discountCodes.some((code) => code.code === value)
  )
  const unconfirmedCodes =
    selectedCodes.length > 0 &&
    (codesPending || Boolean(codesError) || unknownSelectedCodes.length > 0)
  const summary = summarizeDiscountCodes(
    regularPrice,
    quantity,
    selectedDiscountCodes
  )

  useEffect(() => {
    if (!open) return
    let active = true
    startCodesTransition(async () => {
      setCodesError(null)
      const state = await loadDiscountCodesAction(product.id)
      if (!active) return
      setCodesError(state.success ? null : state.message)
      setSavedCodes(state.success && state.data ? state.data : [])
    })
    return () => {
      active = false
    }
  }, [open, product.id, reloadCodes])

  const viewAdvertisement = () =>
    startTransition(async () => {
      const state = await startProductAdvertisementAction(
        shop.code,
        product.slug
      )
      const message = state.success
        ? "Quảng cáo nhận ưu đãi đang tạm thời chưa sẵn sàng. Vui lòng thử lại sau."
        : state.message
      setAdMessage(message)
      toast.error(message)
    })

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      if (unconfirmedCodes) {
        toast.error(
          "Chưa xác nhận được tất cả mã đã chọn. Vui lòng tải lại mã hoặc bỏ mã không hợp lệ trước khi đặt hàng."
        )
        return
      }
      const state = await orderProductAction(
        shop.code,
        product.slug,
        {
          ...values,
          variant_id: variant?.id,
          discount_codes: selectedCodes.length ? selectedCodes : undefined,
        },
        idempotencyKey
      )
      if (!state.success || !state.data) {
        const hasErrors = applyServerErrors(state.errors, form.setError)
        if (
          !hasErrors ||
          state.errors?.discount_codes ||
          state.errors?.discount_code ||
          state.errors?.variant_id
        ) {
          toast.error(
            state.errors?.discount_codes?.[0] ||
              state.errors?.discount_code?.[0] ||
              state.errors?.variant_id?.[0] ||
              state.message
          )
        }
        return
      }
      toast.success(
        `${state.message} Mã đơn: ${state.data.order_number}. Tổng: ${formatCurrency(state.data.total)}`
      )
      const consumed = new Set(
        state.data.redeemed_discount_codes ??
          summary.appliedCodes.map((code) => code.code)
      )
      setSavedCodes((codes) => codes.filter((code) => !consumed.has(code.code)))
      setSelectedCodes([])
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
        if (!pending) onOpenChange(value)
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <div className="grid gap-6 md:grid-cols-2">
          <ProductGallery
            name={product.name}
            imageUrl={product.image_url}
            images={product.images}
            videoUrl={product.video_url}
          />
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
            <p className="text-2xl font-semibold text-primary">
              {formatCurrency(regularPrice)}
            </p>
            <p className="text-sm text-muted-foreground">
              Tích lũy mã từ nhiều lượt xem quảng cáo để giảm tiền hàng, tối đa
              toàn bộ giá trị sản phẩm.
            </p>
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
                disabled={pending || stock < 1}
                onClick={() => {
                  setSelectedCodes([])
                  setCheckout(true)
                }}
              >
                <ShoppingBagIcon /> Đặt ngay · {formatCurrency(regularPrice)}
              </Button>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Xem quảng cáo để nhận mã giảm giá
                </p>
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={pending || stock < 1}
                  onClick={viewAdvertisement}
                >
                  <PlayIcon /> Xem quảng cáo
                </Button>
                <p className="text-xs text-muted-foreground">
                  Quảng cáo do hệ thống tự động cung cấp. Mã được cấp sau khi
                  lượt xem được xác nhận; có thể lưu và cộng dồn để mua với giá
                  0đ.
                </p>
                {adMessage ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    {adMessage}
                  </p>
                ) : null}
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setCheckout(true)}
                disabled={pending || stock < 1}
              >
                Dùng mã đã tích lũy
              </Button>
            </div>
            {checkout ? (
              <Form {...form}>
                <form onSubmit={submit} className="space-y-4 border-t pt-4">
                  <fieldset
                    className="space-y-3"
                    disabled={pending || codesPending}
                  >
                    <legend className="mb-2 font-medium">
                      Mã giảm giá của tôi
                    </legend>
                    {discountCodes.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() =>
                              setSelectedCodes(
                                discountCodes
                                  .slice(0, 100)
                                  .map((code) => code.code)
                              )
                            }
                          >
                            {discountCodes.length > 100
                              ? "Chọn 100 mã đầu"
                              : "Chọn tất cả"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => setSelectedCodes([])}
                          >
                            Không dùng mã
                          </Button>
                        </div>
                        <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border p-3">
                          {discountCodes.map((code) => (
                            <label
                              key={code.id}
                              className="flex items-start gap-2 text-sm"
                            >
                              <Checkbox
                                checked={selectedCodes.includes(code.code)}
                                onCheckedChange={(checked) => {
                                  setSelectedCodes((values) =>
                                    checked
                                      ? values.length < 100 &&
                                        !values.includes(code.code)
                                        ? [...values, code.code]
                                        : values
                                      : values.filter(
                                          (value) => value !== code.code
                                        )
                                  )
                                }}
                              />
                              <span>
                                <span className="font-medium">
                                  Giảm {formatDiscountCodeValue(code)}
                                </span>
                                <br />
                                <span className="text-xs break-all text-muted-foreground">
                                  {code.code} · Hết hạn{" "}
                                  {formatDate(code.expires_at)}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </fieldset>
                  {codesPending ? (
                    <p className="text-xs text-muted-foreground">
                      Đang tải mã giảm giá...
                    </p>
                  ) : codesError ? (
                    <div className="space-y-2 text-xs text-destructive">
                      <p>{codesError}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => setReloadCodes((value) => value + 1)}
                      >
                        Tải lại mã
                      </Button>
                      {codesError.includes("đăng nhập") ? (
                        <Link
                          className="ml-2 underline"
                          href={getAuthPageHref(
                            "/sign-in",
                            `/shops/${shop.code}/products/${product.slug}${initialDiscountCode ? `?discount_code=${encodeURIComponent(initialDiscountCode)}` : ""}`
                          )}
                        >
                          Đăng nhập
                        </Link>
                      ) : null}
                    </div>
                  ) : discountCodes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Bạn chưa có mã còn hiệu lực cho sản phẩm này.
                    </p>
                  ) : null}
                  {unknownSelectedCodes.length > 0 && !codesPending ? (
                    <div className="space-y-2">
                      <p className="text-xs text-destructive">
                        Có mã đã chọn chưa được xác nhận hoặc không còn hiệu
                        lực.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() =>
                          setSelectedCodes((values) =>
                            values.filter((value) =>
                              discountCodes.some((code) => code.code === value)
                            )
                          )
                        }
                      >
                        Bỏ mã không hợp lệ
                      </Button>
                    </div>
                  ) : null}
                  <Link
                    href="/discount-codes"
                    className="text-sm text-primary underline"
                  >
                    Mở kho mã giảm giá
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Có thể dùng nhiều mã. Tổng giảm tối đa bằng tiền hàng; mã
                    chưa cần dùng khi tiền hàng đã về 0đ sẽ được giữ lại.
                  </p>
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
                  <div
                    className="space-y-1 rounded-lg bg-muted p-3"
                    aria-live="polite"
                  >
                    {!validQuantity ? (
                      <p className="text-sm text-destructive">
                        Vui lòng nhập số lượng hợp lệ trong giới hạn tồn kho.
                      </p>
                    ) : unconfirmedCodes ? (
                      <p className="text-sm text-muted-foreground">
                        Đang chờ xác nhận các mã đã chọn.
                      </p>
                    ) : (
                      <>
                        <p className="text-sm">
                          Tiền hàng: {formatCurrency(summary.subtotal)}
                        </p>
                        <p className="text-sm text-primary">
                          Giảm từ mã tích lũy:{" "}
                          {formatCurrency(summary.discount)}
                        </p>
                        <p className="font-semibold">
                          Tổng thanh toán: {formatCurrency(summary.total)}
                        </p>
                        {summary.total === 0 && summary.discount > 0 ? (
                          <p className="text-sm font-medium text-primary">
                            Bạn đã tích lũy đủ mã để đặt đơn 0đ.
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={pending || !validQuantity || unconfirmedCodes}
                  >
                    {pending
                      ? "Đang xử lý..."
                      : validQuantity &&
                          !unconfirmedCodes &&
                          summary.total === 0
                        ? "Xác nhận đặt hàng 0đ"
                        : "Xác nhận đặt hàng"}
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
