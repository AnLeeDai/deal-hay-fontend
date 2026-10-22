"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  LoaderCircleIcon,
  MapPinIcon,
  MessageCircleIcon,
  MinusIcon,
  PackageCheckIcon,
  PlusIcon,
  ShoppingBagIcon,
  StoreIcon,
  TicketPercentIcon,
  TruckIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AddressFields } from "@/components/address-fields"
import { MediaImage } from "@/components/media-image"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { ShippingRewardOffer } from "@/modules/public/components/shipping-reward-offer"
import { productCheckoutHref } from "@/modules/public/lib/product-checkout"
import { orderProductAction, startChatAction } from "@/modules/public/actions"
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

export function ProductCheckout({
  shop,
  product,
  variant,
  regularPrice,
  stock,
  initialDiscountCode,
}: {
  shop: PublicShop
  product: PublicProduct
  variant?: PublicProductVariant
  regularPrice: number
  stock: number
  initialDiscountCode?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [messagePending, startMessageTransition] = useTransition()
  const [completedOrder, setCompletedOrder] = useState<{
    number: string
    total: number
    shippingConfirmed: boolean
    customerName: string
    customerPhone: string
    address: string
    quantity: number
    variantLabel?: string
  } | null>(null)
  const submitting = useRef(false)
  const successHeading = useRef<HTMLHeadingElement>(null)
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
  const [, setShippingAdVisible] = useState(false)
  const [reloadShippingCode, setReloadShippingCode] = useState(0)
  const shippingCodeRevision = useRef(0)
  const [shippingQuote, setShippingQuote] = useState<{
    key: string
    data?: ShippingQuote
    error?: string
  } | null>(null)
  const [shippingPending, startShippingTransition] = useTransition()
  const [reloadShipping, setReloadShipping] = useState(0)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
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
  const productHref = `/shops/${encodeURIComponent(shop.code)}/products/${encodeURIComponent(product.slug)}`
  const productReturnHref = variant
    ? `${productHref}?variant_id=${encodeURIComponent(variant.id)}`
    : productHref
  const checkoutHref = productCheckoutHref(shop.code, product.slug, {
    variantId: variant?.id,
    discountCode: initialDiscountCode,
  })
  const maxQuantity = Math.min(stock, 9999)
  const shippingConfirmed = currentShippingQuote?.data?.fee != null
  const orderBlocked =
    pending ||
    codesPending ||
    !validQuantity ||
    unconfirmedCodes ||
    shippingBlocked ||
    shippingRewardPending ||
    shippingCodeUnconfirmed

  function openProductChat() {
    if (!shop.viewer.can_interact) {
      toast.error("Tài khoản hiện tại không thể nhắn tin cho cửa hàng này.")
      return
    }
    if ((product.has_variants || product.variants.length > 0) && !variant) {
      toast.error("Sản phẩm chưa có biến thể đang bán để tư vấn.")
      return
    }
    startMessageTransition(async () => {
      const state = await startChatAction(shop.code, product.id, variant?.id)
      if (state.success && state.data) {
        router.push(`/chats/${encodeURIComponent(state.data.conversationSlug)}`)
      } else {
        toast.error(
          state.message || "Không thể mở cuộc trò chuyện với cửa hàng."
        )
      }
    })
  }

  useEffect(() => {
    if (!completedOrder) return
    successHeading.current?.focus()
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [completedOrder])

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
  }, [product.id, reloadCodes])

  useEffect(() => {
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
  }, [shop.code, product.slug, reloadShippingCode])

  useEffect(() => {
    if (!provinceCode || !wardCode) return
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

  const submit = (values: CheckoutValues) =>
    startTransition(async () => {
      if (submitting.current || completedOrder) return
      if (!validQuantity) {
        form.setError("quantity", {
          message: `Vui lòng chọn từ 1 đến ${maxQuantity} sản phẩm.`,
        })
        return
      }
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
      submitting.current = true
      try {
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
          const discountCodeError = Object.entries(state.errors ?? {}).find(
            ([name]) =>
              name === "discount_code" ||
              name === "discount_codes" ||
              name.startsWith("discount_codes.")
          )?.[1]?.[0]
          if (
            !hasErrors ||
            state.errors?.quoted_shipping_fee ||
            discountCodeError ||
            state.errors?.shipping_discount_code ||
            state.errors?.variant_id
          ) {
            toast.error(
              state.errors?.quoted_shipping_fee?.[0] ||
                discountCodeError ||
                state.errors?.shipping_discount_code?.[0] ||
                state.errors?.variant_id?.[0] ||
                state.message
            )
          }
          if (state.errors?.quoted_shipping_fee)
            setReloadShipping((value) => value + 1)
          if (state.errors?.shipping_discount_code)
            setReloadShippingCode((value) => value + 1)
          if (discountCodeError) setReloadCodes((value) => value + 1)
          return
        }
        toast.success(
          `${state.message} Mã đơn: ${state.data.order_number}. Tổng: ${formatCurrency(state.data.total)}`
        )
        setCompletedOrder({
          number: state.data.order_number,
          total: state.data.total,
          shippingConfirmed,
          customerName: values.customer_name,
          customerPhone: values.customer_phone,
          address: values.shipping_address,
          quantity: values.quantity,
          variantLabel: variant
            ? variant.variant_label ||
              Object.values(variant.option_values).join(" · ") ||
              variant.sku
            : undefined,
        })
      } catch {
        toast.error("Chưa thể xác nhận đơn hàng. Vui lòng thử lại.")
      } finally {
        submitting.current = false
      }
    })

  if (completedOrder) {
    return (
      <section
        className="mx-auto max-w-2xl space-y-6 py-6 sm:py-10"
        aria-labelledby="order-success-title"
      >
        <div className="space-y-3 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2Icon className="size-8" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-primary">
            Cảm ơn bạn đã mua sắm
          </p>
          <h1
            id="order-success-title"
            ref={successHeading}
            tabIndex={-1}
            className="font-heading text-3xl font-semibold outline-none"
          >
            Đặt hàng thành công
          </h1>
          <p className="text-muted-foreground">
            Đơn hàng đã được gửi đến {shop.name}.
          </p>
        </div>
        <div className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
          <dl className="space-y-4">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Mã đơn hàng</dt>
              <dd className="font-semibold break-all">
                {completedOrder.number}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
              <dt>
                {completedOrder.shippingConfirmed
                  ? "Tổng thanh toán"
                  : "Tiền hàng sau giảm"}
              </dt>
              <dd className="text-xl font-semibold text-primary">
                {formatCurrency(completedOrder.total)}
              </dd>
            </div>
          </dl>
          {!completedOrder.shippingConfirmed ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Phí vận chuyển chưa được xác định. Vui lòng trao đổi với cửa hàng
              để xác nhận phí giao hàng.
            </p>
          ) : null}
          <div className="space-y-1 border-t pt-4 text-sm">
            <p className="font-medium">
              {completedOrder.customerName} · {completedOrder.customerPhone}
            </p>
            <p className="text-muted-foreground">{completedOrder.address}</p>
            <p className="pt-2">
              {product.name}
              {completedOrder.variantLabel
                ? ` · ${completedOrder.variantLabel}`
                : ""}
              {` · Số lượng: ${completedOrder.quantity}`}
            </p>
          </div>
          <Button
            className="w-full"
            size="lg"
            variant="outline"
            disabled={messagePending}
            onClick={openProductChat}
          >
            {messagePending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <MessageCircleIcon />
            )}
            {messagePending
              ? "Đang mở cuộc trò chuyện..."
              : "Nhắn với shop về đơn hàng"}
          </Button>
        </div>
        <Link
          href={`/shops/${encodeURIComponent(shop.code)}`}
          className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          Tiếp tục mua sắm <ArrowRightIcon className="size-4" />
        </Link>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <nav
        aria-label="Điều hướng đặt hàng"
        className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
      >
        <Link
          href={productReturnHref}
          className="inline-flex items-center gap-1.5 hover:text-primary"
        >
          <ArrowLeftIcon className="size-4" /> Quay lại sản phẩm
        </Link>
        <ChevronRightIcon className="size-3.5" aria-hidden="true" />
        <span aria-current="page" className="font-medium text-foreground">
          Đặt hàng
        </span>
      </nav>

      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl">
          Hoàn tất đơn hàng
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Kiểm tra sản phẩm, điền thông tin giao hàng và áp dụng ưu đãi của bạn.
        </p>
      </header>

      <Form {...form}>
        <form
          noValidate
          onSubmit={(event) => {
            void form.handleSubmit(submit)(event)
          }}
          className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <fieldset disabled={pending} className="min-w-0 space-y-5">
            <legend className="sr-only">Thông tin đơn hàng</legend>
            <section
              aria-labelledby="checkout-product-title"
              className="overflow-hidden rounded-2xl border bg-card"
            >
              <div className="flex items-center gap-3 border-b px-4 py-4 sm:px-6">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShoppingBagIcon className="size-4" aria-hidden="true" />
                </span>
                <h2 id="checkout-product-title" className="font-semibold">
                  Sản phẩm đặt mua
                </h2>
              </div>
              <div className="space-y-5 p-4 sm:p-6">
                <Link
                  href={`/shops/${encodeURIComponent(shop.code)}`}
                  className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary"
                >
                  <StoreIcon className="size-4 text-muted-foreground" />{" "}
                  {shop.name}
                  <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                </Link>
                <div className="flex items-start gap-4">
                  <MediaImage
                    src={product.image_url || product.images[0]?.image_url}
                    alt={product.name}
                    className="size-20 shrink-0 rounded-xl sm:size-24"
                    sizes="96px"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <h3 className="leading-6 font-medium break-words">
                      {product.name}
                    </h3>
                    {variant ? (
                      <p className="text-sm text-muted-foreground">
                        {variant.variant_label ||
                          Object.values(variant.option_values).join(" · ") ||
                          variant.sku}
                      </p>
                    ) : null}
                    <p className="font-semibold text-primary">
                      {formatCurrency(regularPrice)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        / sản phẩm
                      </span>
                    </p>
                    <Link
                      href={productReturnHref}
                      className="inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-primary"
                    >
                      Thay đổi sản phẩm hoặc phân loại
                    </Link>
                  </div>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3 border-t pt-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số lượng</FormLabel>
                        <div className="flex items-center gap-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="rounded-r-none"
                            aria-label="Giảm số lượng"
                            disabled={quantity <= 1}
                            onClick={() =>
                              field.onChange(Math.max(1, quantity - 1))
                            }
                          >
                            <MinusIcon />
                          </Button>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={maxQuantity}
                              className="h-9 w-16 [appearance:textfield] rounded-none border-x-0 text-center shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              onChange={(event) =>
                                field.onChange(Number(event.target.value))
                              }
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="rounded-l-none"
                            aria-label="Tăng số lượng"
                            disabled={quantity >= maxQuantity}
                            onClick={() =>
                              field.onChange(
                                Math.min(maxQuantity, Math.max(1, quantity + 1))
                              )
                            }
                          >
                            <PlusIcon />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p
                    className={`flex items-center gap-1.5 pt-1 text-xs ${stock > 0 ? "text-muted-foreground" : "text-destructive"}`}
                  >
                    <PackageCheckIcon className="size-4" />
                    {stock > 0
                      ? `Còn ${stock} sản phẩm`
                      : "Sản phẩm tạm hết hàng"}
                  </p>
                </div>
              </div>
            </section>

            <section
              aria-labelledby="checkout-delivery-title"
              className="overflow-hidden rounded-2xl border bg-card"
            >
              <div className="flex items-center gap-3 border-b px-4 py-4 sm:px-6">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPinIcon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="checkout-delivery-title" className="font-semibold">
                    Thông tin giao hàng
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Cửa hàng sẽ giao theo thông tin bạn cung cấp.
                  </p>
                </div>
              </div>
              <div className="space-y-4 p-4 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["customer_name", "Tên người nhận", "Nhập họ và tên"],
                      ["customer_phone", "Số điện thoại", "Nhập số điện thoại"],
                    ] as const
                  ).map(([name, label, placeholder]) => (
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
                              type={name === "customer_phone" ? "tel" : "text"}
                              autoComplete={
                                name === "customer_phone" ? "tel" : "name"
                              }
                              placeholder={placeholder}
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
                </div>
                <FormField
                  control={form.control}
                  name="shipping_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Số nhà, tên đường</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="street-address"
                          placeholder="Ví dụ: Số 12, ngõ 34, đường Nguyễn Trãi"
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
                      <FormLabel>
                        Ghi chú cho cửa hàng{" "}
                        <span className="font-normal text-muted-foreground">
                          (không bắt buộc)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={3}
                          placeholder="Lưu ý về sản phẩm hoặc thời gian nhận hàng..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div
                  className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-sm"
                  aria-live="polite"
                >
                  <TruckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="space-y-2">
                    <p
                      className={
                        currentShippingQuote?.error
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {!shippingLocationSelected
                        ? "Chọn tỉnh/thành và phường/xã để xem phí vận chuyển."
                        : shippingBlocked
                          ? currentShippingQuote?.error ||
                            "Đang lấy phí vận chuyển..."
                          : !shippingConfirmed
                            ? "Địa chỉ này cần trao đổi phí vận chuyển với cửa hàng. Tiền hàng được hiển thị riêng bên dưới."
                            : shippingFee === 0
                              ? "Cửa hàng miễn phí vận chuyển đến địa chỉ này."
                              : `Phí vận chuyển đến địa chỉ này: ${formatCurrency(shippingFee)}.`}
                    </p>
                    {currentShippingQuote?.error ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={shippingPending}
                        onClick={() => setReloadShipping((value) => value + 1)}
                      >
                        Tải lại phí vận chuyển
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section
              aria-labelledby="checkout-discount-title"
              className="overflow-hidden rounded-2xl border bg-card"
            >
              <div className="flex items-center gap-3 border-b px-4 py-4 sm:px-6">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <TicketPercentIcon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="checkout-discount-title" className="font-semibold">
                    Ưu đãi của bạn
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Chọn mã giảm tiền hàng và ưu đãi vận chuyển.
                  </p>
                </div>
              </div>
              <div className="space-y-4 p-4 sm:p-6">
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
                        href={getAuthPageHref("/sign-in", checkoutHref)}
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
                      Có mã đã chọn chưa được xác nhận hoặc không còn hiệu lực.
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
                  Có thể dùng nhiều mã. Tổng giảm tối đa bằng tiền hàng; mã chưa
                  cần dùng khi tiền hàng đã về 0đ sẽ được giữ lại.
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
                        Áp dụng tại Hà Nội khi shop có báo phí. Mã được giữ lại
                        nếu đơn chưa có phí ship.
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

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  aria-expanded={showShippingOffer}
                  aria-controls="checkout-shipping-offer"
                  disabled={pending || stock < 1 || shippingRewardPending}
                  onClick={() => setShowShippingOffer((value) => !value)}
                >
                  <TruckIcon />{" "}
                  {showShippingOffer
                    ? "Thu gọn ưu đãi vận chuyển"
                    : "Khám phá ưu đãi miễn phí vận chuyển"}
                </Button>
                {showShippingOffer ? (
                  <div id="checkout-shipping-offer">
                    <ShippingRewardOffer
                      shopCode={shop.code}
                      productSlug={product.slug}
                      code={availableShippingCode}
                      disabled={pending}
                      returnTo={checkoutHref}
                      onRedeemingChange={setShippingRewardPending}
                      onAdVisibleChange={setShippingAdVisible}
                      onCodeReceived={(code) => {
                        shippingCodeRevision.current += 1
                        setShippingCode(code)
                        setShippingCodeError(null)
                        setUseShippingCode(true)
                        toast.success("Đã nhận mã miễn phí vận chuyển.")
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </section>
          </fieldset>

          <aside
            className="min-w-0 space-y-4 lg:sticky lg:top-28"
            aria-labelledby="checkout-summary-title"
          >
            <section className="overflow-hidden rounded-2xl border bg-card">
              <div className="border-b px-5 py-5">
                <h2
                  id="checkout-summary-title"
                  className="text-lg font-semibold"
                >
                  Tóm tắt đơn hàng
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {validQuantity
                    ? `${quantity} sản phẩm từ ${shop.name}`
                    : "Kiểm tra lại số lượng sản phẩm"}
                </p>
              </div>
              <div className="space-y-5 p-5">
                <div
                  className="space-y-4"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Tiền hàng</dt>
                      <dd className="font-medium">
                        {validQuantity ? formatCurrency(summary.subtotal) : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">
                        Giảm giá sản phẩm
                      </dt>
                      <dd className="text-primary">
                        {unconfirmedCodes
                          ? "Đang xác nhận"
                          : validQuantity
                            ? `−${formatCurrency(summary.discount)}`
                            : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Phí vận chuyển</dt>
                      <dd className="text-right">
                        {!shippingLocationSelected
                          ? "Chọn địa chỉ"
                          : shippingBlocked
                            ? "Chưa xác nhận"
                            : shippingConfirmed
                              ? formatCurrency(shippingFee)
                              : "Trao đổi với shop"}
                      </dd>
                    </div>
                    {appliedShippingCode ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">
                          Giảm phí vận chuyển
                        </dt>
                        <dd className="text-primary">
                          −{formatCurrency(shippingDiscount)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
                    <span className="font-semibold">
                      {shippingConfirmed
                        ? "Tổng thanh toán"
                        : "Tiền hàng sau giảm"}
                    </span>
                    <span className="text-2xl font-semibold tracking-tight text-primary">
                      {!validQuantity ||
                      unconfirmedCodes ||
                      shippingBlocked ||
                      shippingCodeUnconfirmed
                        ? "—"
                        : formatCurrency(summary.total + shippingTotal)}
                    </span>
                  </div>
                  {!validQuantity ? (
                    <p className="text-sm text-destructive" role="alert">
                      {stock < 1
                        ? "Sản phẩm đã hết hàng. Vui lòng quay lại để chọn sản phẩm khác."
                        : `Vui lòng chọn số lượng từ 1 đến ${maxQuantity}.`}
                    </p>
                  ) : null}
                  {unconfirmedCodes ? (
                    <p className="text-xs text-muted-foreground">
                      Vui lòng xác nhận các mã đã chọn trong phần ưu đãi.
                    </p>
                  ) : null}
                  {shippingCodeUnconfirmed ? (
                    <p className="text-xs text-muted-foreground">
                      Đang chờ xác nhận mã vận chuyển.
                    </p>
                  ) : null}
                  {shippingRewardPending ? (
                    <p className="text-xs text-muted-foreground">
                      Hoàn tất hoặc hủy xem quảng cáo trước khi xác nhận đơn.
                    </p>
                  ) : null}
                  {!shippingConfirmed && !shippingBlocked ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {shippingLocationSelected
                        ? "Chưa bao gồm phí vận chuyển. Vui lòng xác nhận phí với shop."
                        : "Phí vận chuyển sẽ hiển thị sau khi bạn chọn địa chỉ."}
                    </p>
                  ) : null}
                  {validQuantity &&
                  !unconfirmedCodes &&
                  summary.total === 0 &&
                  summary.discount > 0 ? (
                    <p className="rounded-lg bg-primary/5 p-3 text-xs font-medium text-primary">
                      Ưu đãi đã giảm toàn bộ tiền hàng của bạn.
                    </p>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full text-base"
                  disabled={orderBlocked}
                >
                  {pending ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <ShoppingBagIcon />
                  )}
                  {pending
                    ? "Đang xác nhận..."
                    : validQuantity &&
                        !unconfirmedCodes &&
                        summary.total + shippingTotal === 0 &&
                        shippingConfirmed
                      ? "Xác nhận đặt hàng 0đ"
                      : "Xác nhận đặt hàng"}
                </Button>
                <p className="text-center text-xs leading-5 text-muted-foreground">
                  Kiểm tra thông tin giao hàng và tổng tiền trước khi xác nhận.
                </p>
              </div>
            </section>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              disabled={pending || messagePending || shippingRewardPending}
              onClick={openProductChat}
            >
              {messagePending ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <MessageCircleIcon />
              )}
              {messagePending
                ? "Đang mở cuộc trò chuyện..."
                : "Cần hỗ trợ? Nhắn với shop"}
            </Button>
          </aside>
        </form>
      </Form>
    </div>
  )
}
