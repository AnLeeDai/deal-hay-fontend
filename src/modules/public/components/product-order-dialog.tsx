"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { MessageCircleIcon, ShoppingBagIcon, TruckIcon } from "lucide-react"
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
import { ShippingRewardOffer } from "@/modules/public/components/shipping-reward-offer"
import { orderProductAction } from "@/modules/public/actions"
import {
  checkoutSchema,
  type CheckoutValues,
} from "@/modules/public/schemas/checkout"
import { applyServerErrors } from "@/lib/form-utils"
import { formatCurrency, formatDate } from "@/lib/format"
import { getAuthPageHref } from "@/lib/auth-redirect"
import {
  loadDiscountCodesAction,
  saveDiscountCodeAction,
} from "@/modules/discount-codes/actions"
import { loadShippingQuoteAction } from "@/modules/public/shipping-actions"
import { loadShippingDiscountCodeAction } from "@/modules/public/shipping-reward-actions"
import { summarizeDiscountCodes } from "@/modules/discount-codes/lib/discount-codes"
import { formatDiscountCodeValue } from "@/modules/discount-codes/lib/format-discount-code"
import type { ProductDiscountCode } from "@/types/discount-code"
import type { ShippingQuote } from "@/types/shipping"
import type { ShippingDiscountCode } from "@/types/shipping-reward"
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
  const [enteredCode, setEnteredCode] = useState("")
  const [showShippingOffer, setShowShippingOffer] = useState(false)
  const [shippingCode, setShippingCode] = useState<ShippingDiscountCode | null>(
    null
  )
  const [useShippingCode, setUseShippingCode] = useState(true)
  const [shippingCodeError, setShippingCodeError] = useState<string | null>(
    null
  )
  const [shippingCodePending, startShippingCodeTransition] = useTransition()
  const [shippingRewardPending, setShippingRewardPending] = useState(false)
  const [reloadShippingCode, setReloadShippingCode] = useState(0)
  const shippingCodeRevision = useRef(0)
  const [shippingQuote, setShippingQuote] = useState<{
    key: string
    data?: ShippingQuote
    error?: string
  } | null>(null)
  const [shippingPending, startShippingTransition] = useTransition()
  const [reloadShipping, setReloadShipping] = useState(0)
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
  const provinceCode = useWatch({
    control: form.control,
    name: "shipping_province_code",
  })
  const wardCode = useWatch({
    control: form.control,
    name: "shipping_ward_code",
  })
  const shippingKey = `${shop.code}:${product.slug}:${provinceCode}:${wardCode}`
  const currentShippingQuote =
    shippingQuote?.key === shippingKey ? shippingQuote : null
  const shippingLocationSelected = Boolean(provinceCode && wardCode)
  const shippingBlocked =
    shippingLocationSelected &&
    (shippingPending ||
      !currentShippingQuote?.data ||
      Boolean(currentShippingQuote.error))
  const shippingFee = currentShippingQuote?.data?.fee ?? 0
  const shippingCodeId = shippingCode?.id
  const shippingCodeExpiresAt = shippingCode?.expires_at
  const availableShippingCode =
    shippingCode?.is_available &&
    !shippingCode.used_at &&
    shippingCode.product_id === product.id
      ? shippingCode
      : null
  const shippingCodeUnconfirmed =
    Boolean(availableShippingCode && useShippingCode) &&
    (shippingCodePending || Boolean(shippingCodeError))
  const appliedShippingCode =
    availableShippingCode &&
    useShippingCode &&
    !shippingCodeUnconfirmed &&
    !shippingBlocked &&
    shippingFee > 0
      ? availableShippingCode
      : null
  const shippingDiscount = appliedShippingCode ? shippingFee : 0
  const shippingTotal = shippingFee - shippingDiscount
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
    if (!shippingCodeId || !shippingCodeExpiresAt) return
    const expiresAt = Date.parse(shippingCodeExpiresAt)
    let timeout: ReturnType<typeof setTimeout>
    function checkExpiry() {
      const remaining = expiresAt - Date.now()
      if (!Number.isFinite(remaining) || remaining <= 0) {
        setShippingCode((code) =>
          code && code.id === shippingCodeId
            ? { ...code, is_available: false }
            : code
        )
      } else {
        timeout = setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647))
      }
    }
    timeout = setTimeout(checkExpiry, 0)
    return () => clearTimeout(timeout)
  }, [shippingCodeId, shippingCodeExpiresAt])

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

  useEffect(() => {
    if (!open) return
    let active = true
    const revision = ++shippingCodeRevision.current
    startShippingCodeTransition(async () => {
      const state = await loadShippingDiscountCodeAction(
        shop.code,
        product.slug
      )
      if (!active || revision !== shippingCodeRevision.current) return
      setShippingCodeError(state.success ? null : state.message)
      if (state.success) setShippingCode(state.data ?? null)
    })
    return () => {
      active = false
    }
  }, [open, shop.code, product.slug, reloadShippingCode])

  useEffect(() => {
    if (!open || !checkout || !provinceCode || !wardCode) return
    let active = true
    startShippingTransition(async () => {
      const result = await loadShippingQuoteAction(
        shop.code,
        product.slug,
        provinceCode,
        wardCode
      )
      if (!active) return
      setShippingQuote({
        key: shippingKey,
        data: result.success ? result.data : undefined,
        error: result.success ? undefined : result.message,
      })
    })
    return () => {
      active = false
    }
  }, [
    open,
    checkout,
    provinceCode,
    wardCode,
    shop.code,
    product.slug,
    shippingKey,
    reloadShipping,
  ])

  function applyEnteredCode() {
    const value = enteredCode.trim().toUpperCase()
    const code = savedCodes.find(
      (item) => item.code === value && item.product.id === product.id
    )
    if (
      !code ||
      code.used_at ||
      new Date(code.expires_at).getTime() <= Date.now()
    ) {
      toast.error("Mã không thuộc sản phẩm này, đã hết hạn hoặc đã sử dụng.")
      return
    }
    if (selectedCodes.includes(code.code)) {
      toast.info("Mã này đã được chọn.")
      return
    }
    if (selectedCodes.length >= 100) {
      toast.error("Mỗi đơn hàng áp dụng tối đa 100 mã.")
      return
    }
    startCodesTransition(async () => {
      const result = code.is_available
        ? { success: true, data: code, message: "" }
        : await saveDiscountCodeAction(code.id)
      if (!result.success || !result.data?.is_available) {
        toast.error(result.message || "Mã chưa thể sử dụng cho đơn hàng này.")
        return
      }
      const confirmed = result.data
      setSavedCodes((codes) =>
        codes.map((item) => (item.id === confirmed.id ? confirmed : item))
      )
      setSelectedCodes((values) =>
        values.includes(confirmed.code)
          ? values
          : [...values, confirmed.code].slice(0, 100)
      )
      setEnteredCode("")
    })
  }

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      if (codesPending) {
        toast.error("Vui lòng chờ xác nhận mã giảm giá trước khi đặt hàng.")
        return
      }
      if (shippingBlocked) {
        toast.error(
          "Vui lòng chờ hoặc tải lại phí vận chuyển trước khi đặt hàng."
        )
        return
      }
      if (shippingRewardPending || shippingCodeUnconfirmed) {
        toast.error("Vui lòng chờ xác nhận mã vận chuyển trước khi đặt hàng.")
        return
      }
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
          shipping_discount_code: appliedShippingCode?.code,
          quoted_shipping_fee:
            currentShippingQuote?.data?.configured &&
            currentShippingQuote.data.eligible
              ? shippingFee
              : undefined,
        },
        idempotencyKey
      )
      if (!state.success || !state.data) {
        const hasErrors = applyServerErrors(state.errors, form.setError)
        if (
          !hasErrors ||
          state.errors?.quoted_shipping_fee ||
          state.errors?.discount_codes ||
          state.errors?.discount_code ||
          state.errors?.shipping_discount_code ||
          state.errors?.variant_id
        ) {
          toast.error(
            state.errors?.quoted_shipping_fee?.[0] ||
              state.errors?.discount_codes?.[0] ||
              state.errors?.discount_code?.[0] ||
              state.errors?.shipping_discount_code?.[0] ||
              state.errors?.variant_id?.[0] ||
              state.message
          )
        }
        if (state.errors?.quoted_shipping_fee)
          setReloadShipping((value) => value + 1)
        if (state.errors?.shipping_discount_code)
          setReloadShippingCode((value) => value + 1)
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
      if (appliedShippingCode) setShippingCode(null)
      setUseShippingCode(true)
      setShowShippingOffer(false)
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
        if (!pending && !shippingRewardPending) {
          if (!value) setShowShippingOffer(false)
          onOpenChange(value)
        }
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
              Bạn có thể nhập hoặc chọn mã của sản phẩm ở bước xác nhận đơn
              hàng.
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
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  setShowShippingOffer(true)
                  setCheckout(true)
                }}
                disabled={pending || stock < 1}
              >
                <TruckIcon /> Miễn phí vận chuyển
              </Button>
            </div>
            {showShippingOffer ? (
              <ShippingRewardOffer
                shopCode={shop.code}
                productSlug={product.slug}
                code={availableShippingCode}
                disabled={pending}
                onRedeemingChange={setShippingRewardPending}
                onCodeReceived={(code) => {
                  shippingCodeRevision.current += 1
                  setShippingCode(code)
                  setShippingCodeError(null)
                  setUseShippingCode(true)
                  toast.success("Đã nhận mã miễn phí vận chuyển.")
                }}
              />
            ) : null}
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
                    <div className="flex gap-2">
                      <Input
                        aria-label="Mã giảm giá của sản phẩm"
                        autoCapitalize="characters"
                        autoComplete="off"
                        placeholder="Nhập mã của sản phẩm"
                        maxLength={32}
                        value={enteredCode}
                        onChange={(event) => setEnteredCode(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            if (enteredCode.trim()) applyEnteredCode()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!enteredCode.trim()}
                        onClick={applyEnteredCode}
                      >
                        Áp dụng
                      </Button>
                    </div>
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
                  {availableShippingCode ? (
                    <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                      <Checkbox
                        checked={useShippingCode}
                        disabled={pending || shippingRewardPending}
                        onCheckedChange={(checked) =>
                          setUseShippingCode(Boolean(checked))
                        }
                      />
                      <span>
                        <span className="font-medium">
                          Giảm 100% phí vận chuyển
                        </span>
                        <br />
                        <span className="text-xs break-all text-muted-foreground">
                          {availableShippingCode.code} · Hết hạn{" "}
                          {formatDate(availableShippingCode.expires_at)}
                        </span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          Áp dụng tại Hà Nội khi shop có báo phí. Mã được giữ
                          lại nếu đơn chưa có phí ship.
                        </span>
                      </span>
                    </label>
                  ) : null}
                  {shippingCodeError &&
                  !shippingCodeError.includes("đăng nhập") ? (
                    <div
                      className="space-y-2 text-xs text-destructive"
                      role="alert"
                    >
                      <p>{shippingCodeError}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={shippingCodePending || pending}
                        onClick={() =>
                          setReloadShippingCode((value) => value + 1)
                        }
                      >
                        Tải lại mã vận chuyển
                      </Button>
                    </div>
                  ) : null}
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
                        <p className="text-sm">
                          Phí vận chuyển:{" "}
                          {!shippingLocationSelected
                            ? "chọn địa chỉ để xem phí"
                            : shippingBlocked
                              ? currentShippingQuote?.error ||
                                "Đang lấy phí vận chuyển..."
                              : currentShippingQuote?.data?.fee === null
                                ? "trao đổi với shop"
                                : formatCurrency(shippingFee)}
                        </p>
                        {appliedShippingCode ? (
                          <p className="text-sm text-primary">
                            Giảm phí vận chuyển:{" "}
                            {formatCurrency(shippingDiscount)}
                          </p>
                        ) : null}
                        {shippingCodeUnconfirmed ? (
                          <p className="text-sm text-muted-foreground">
                            Đang chờ xác nhận mã vận chuyển.
                          </p>
                        ) : null}
                        {currentShippingQuote?.error ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={shippingPending}
                            onClick={() =>
                              setReloadShipping((value) => value + 1)
                            }
                          >
                            Tải lại phí vận chuyển
                          </Button>
                        ) : null}
                        <p className="font-semibold">
                          {currentShippingQuote?.data?.fee != null
                            ? "Tổng thanh toán"
                            : "Tiền hàng sau giảm"}
                          : {formatCurrency(summary.total + shippingTotal)}
                        </p>
                        {summary.total === 0 &&
                        summary.discount > 0 &&
                        shippingTotal === 0 ? (
                          <p className="text-sm font-medium text-primary">
                            Mã đã giảm toàn bộ tiền hàng.
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      pending ||
                      codesPending ||
                      !validQuantity ||
                      unconfirmedCodes ||
                      shippingBlocked ||
                      shippingRewardPending ||
                      shippingCodeUnconfirmed
                    }
                  >
                    {pending
                      ? "Đang xử lý..."
                      : validQuantity &&
                          !unconfirmedCodes &&
                          summary.total + shippingTotal === 0 &&
                          currentShippingQuote?.data?.fee != null
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
