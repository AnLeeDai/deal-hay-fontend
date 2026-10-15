"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  BadgeCheckIcon,
  HeartIcon,
  LoaderCircleIcon,
  PackageCheckIcon,
  PaperclipIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  ShoppingBagIcon,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormSelect } from "@/components/form-select"
import { FormSubmitButton } from "@/components/form-submit-button"
import { SelectedFilePreview } from "@/components/selected-file-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import {
  appendOptionalFile,
  applyServerErrors,
  runUploadAction,
} from "@/lib/form-utils"
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/validation"
import { prepareImageUploads } from "@/lib/image-upload"
import { formatCurrency } from "@/lib/format"
import {
  deleteReviewAction,
  reactShopAction,
  reviewProductAction,
  startChatAction,
  toggleFollowAction,
} from "@/modules/public/actions"
import {
  reviewProductSchema,
  type ReviewProductValues,
} from "@/modules/public/schemas/reviews"
import {
  defaultProductVariant,
  selectProductVariant,
  variantHasOption,
} from "@/modules/public/lib/variant-selection"
import type { PublicProduct, PublicShop } from "@/types/catalog"
import { ProductOrderDialog } from "@/modules/public/components/product-order-dialog"

function ReviewProductForm({
  shopCode,
  productSlug,
}: {
  shopCode: string
  productSlug: string
}) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<ReviewProductValues>({
    resolver: zodResolver(reviewProductSchema),
    defaultValues: { reaction: "like", content: "", image: undefined },
  })

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData()
    formData.set("reaction", values.reaction)
    formData.set("content", values.content)
    appendOptionalFile(formData, "image", values.image)

    startTransition(async () => {
      const state = await runUploadAction(async () =>
        reviewProductAction(
          shopCode,
          productSlug,
          await prepareImageUploads(formData, "review")
        )
      )
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)
      if (state.success) {
        toast.success(state.message)
        form.reset({ reaction: "like", content: "", image: undefined })
      } else if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <FormField
          control={form.control}
          name="reaction"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mức độ hài lòng</FormLabel>
              <FormSelect
                inputRef={field.ref}
                name={field.name}
                options={[
                  { label: "Hài lòng với sản phẩm", value: "like" },
                  { label: "Chưa hài lòng", value: "dislike" },
                ]}
                value={field.value}
                onBlur={field.onBlur}
                onValueChange={field.onChange}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nội dung đánh giá</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Chia sẻ trải nghiệm thực tế của bạn..."
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="image"
          render={({ field: { onChange, value, ...field } }) => (
            <FormItem>
              <FormLabel>Ảnh minh họa (tuỳ chọn)</FormLabel>
              <FormControl>
                <div>
                  {value instanceof File ? (
                    <SelectedFilePreview
                      file={value}
                      onRemove={() => onChange(undefined)}
                    />
                  ) : (
                    <Input
                      accept={IMAGE_UPLOAD_ACCEPT}
                      name={field.name}
                      ref={field.ref}
                      type="file"
                      onBlur={field.onBlur}
                      onChange={(event) =>
                        onChange(event.target.files?.[0] ?? undefined)
                      }
                    />
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormSubmitButton
          className="w-full"
          idleText="Gửi đánh giá"
          pending={isPending}
          pendingText="Đang gửi..."
        />
      </form>
    </Form>
  )
}

export function ProductInteractions({
  shop,
  product,
  canReview = false,
  hasReview = false,
  initialDiscountCode,
}: {
  shop: PublicShop
  product: PublicProduct
  canReview?: boolean
  hasReview?: boolean
  initialDiscountCode?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [isChatPending, startChatTransition] = useTransition()
  const [orderOpen, setOrderOpen] = useState(Boolean(initialDiscountCode))
  const router = useRouter()
  const [selectedVariantId, setSelectedVariantId] = useState(
    () => defaultProductVariant(product.variants)?.id
  )
  const hasVariants = product.has_variants || product.variants.length > 0
  const selectedVariant = hasVariants
    ? (product.variants.find(
        (variant) => variant.id === selectedVariantId && variant.is_active
      ) ?? defaultProductVariant(product.variants))
    : undefined
  const displayedPrice = selectedVariant?.price ?? product.price
  const regularPrice =
    product.old_price && product.old_price > product.price && product.price > 0
      ? Math.max(
          displayedPrice,
          Math.round((displayedPrice * product.old_price) / product.price)
        )
      : displayedPrice
  const displayedStock =
    selectedVariant?.stock ?? (hasVariants ? 0 : product.stock)

  const runAction = (
    action: () => Promise<unknown>,
    successMessage: string,
    errorMessage: string
  ) =>
    startTransition(async () => {
      try {
        await action()
        toast.success(successMessage)
      } catch {
        toast.error(errorMessage)
      }
    })

  const openProductChat = () => {
    if (!shop.viewer.can_interact) {
      toast.error("Tài khoản hiện tại không thể nhắn tin cho cửa hàng này.")
      return
    }

    if (hasVariants && !selectedVariant) {
      toast.error("Sản phẩm chưa có biến thể đang bán để tư vấn.")
      return
    }

    startChatTransition(async () => {
      const state = await startChatAction(
        shop.code,
        product.id,
        selectedVariant?.id
      )

      if (state.success && state.data) {
        toast.success(state.message)
        router.push(`/chats/${encodeURIComponent(state.data.conversationSlug)}`)
        return
      }

      toast.error(state.message || "Không thể mở cuộc trò chuyện với cửa hàng.")
    })
  }

  return (
    <div className="space-y-4 lg:sticky lg:top-28">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{product.category}</Badge>
            {product.label ? (
              <Badge variant="outline">{product.label}</Badge>
            ) : null}
          </div>
          <CardTitle className="font-heading text-2xl leading-tight sm:text-3xl">
            {product.name}
          </CardTitle>
          <CardDescription>
            {selectedVariant ? "SKU biến thể" : "Mã sản phẩm"}:{" "}
            {selectedVariant?.sku || product.sku || "Đang cập nhật"}
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-5">
          <div aria-live="polite" className="space-y-1">
            <p className="text-3xl font-semibold text-primary">
              {formatCurrency(regularPrice)}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
            <span className="flex items-center gap-2 text-sm">
              <PackageCheckIcon className="size-4 text-primary" /> Tình trạng
            </span>
            <Badge
              aria-live="polite"
              variant={displayedStock > 0 ? "secondary" : "destructive"}
            >
              {displayedStock > 0
                ? `Còn ${displayedStock} sản phẩm`
                : "Tạm hết hàng"}
            </Badge>
          </div>

          {hasVariants && product.options.length > 0 ? (
            <div className="space-y-3">
              {product.options.map((option) => (
                <fieldset key={option.id ?? option.name} className="space-y-2">
                  <legend className="text-sm font-medium">{option.name}</legend>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value) => {
                      const candidate = selectProductVariant(
                        product.variants,
                        selectedVariant,
                        option.name,
                        value
                      )
                      const isSelected = selectedVariant
                        ? variantHasOption(selectedVariant, option.name, value)
                        : false

                      return (
                        <Button
                          key={value}
                          aria-pressed={isSelected}
                          disabled={!candidate || isChatPending}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => setSelectedVariantId(candidate?.id)}
                        >
                          {value}
                        </Button>
                      )
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : null}

          {hasVariants && product.options.length === 0 ? (
            <div
              aria-label="Biến thể sản phẩm"
              className="flex flex-wrap gap-2"
              role="group"
            >
              {product.variants
                .filter((variant) => variant.is_active)
                .map((variant) => (
                  <Button
                    key={variant.id}
                    aria-pressed={selectedVariant?.id === variant.id}
                    disabled={isChatPending}
                    type="button"
                    variant={
                      selectedVariant?.id === variant.id ? "default" : "outline"
                    }
                    onClick={() => setSelectedVariantId(variant.id)}
                  >
                    {variant.variant_label || variant.sku}
                  </Button>
                ))}
            </div>
          ) : null}

          {hasVariants ? (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {selectedVariant
                ? `Đã chọn: ${selectedVariant.variant_label || Object.values(selectedVariant.option_values).join(" · ") || selectedVariant.sku}`
                : "Sản phẩm chưa có biến thể đang bán."}
            </p>
          ) : null}

          <Button
            className="w-full"
            disabled={
              isPending ||
              isChatPending ||
              displayedStock < 1 ||
              (hasVariants && !selectedVariant)
            }
            size="lg"
            onClick={() => setOrderOpen(true)}
          >
            {isChatPending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <ShoppingBagIcon />
            )}
            {isChatPending ? "Đang mở cuộc trò chuyện..." : "Đặt hàng"}
          </Button>

          <Separator />

          <div className="flex items-center gap-3">
            <UserAvatar
              className="size-11"
              name={shop.name}
              size="lg"
              src={shop.avatar_url}
            />
            <div className="min-w-0 flex-1">
              <Link
                className="flex items-center gap-1.5 font-medium hover:text-primary"
                href={`/shops/${shop.code}`}
              >
                <span className="truncate">{shop.name}</span>
                <BadgeCheckIcon className="size-4 shrink-0 text-primary" />
              </Link>
              <p className="text-xs text-muted-foreground">
                {shop.is_online ? "Đang hoạt động" : "Hiện không trực tuyến"} ·{" "}
                {shop.followers_count} người theo dõi
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              disabled={isPending}
              variant={shop.viewer.is_following ? "secondary" : "outline"}
              onClick={() =>
                runAction(
                  () => toggleFollowAction(shop.code, shop.viewer.is_following),
                  shop.viewer.is_following
                    ? "Đã bỏ theo dõi cửa hàng."
                    : "Đã theo dõi cửa hàng.",
                  "Không thể cập nhật theo dõi."
                )
              }
            >
              <HeartIcon />{" "}
              <span className="hidden sm:inline">
                {shop.viewer.is_following ? "Đang theo dõi" : "Theo dõi"}
              </span>
            </Button>
            <Button
              disabled={isPending}
              variant={
                shop.viewer.reaction === "like" ? "secondary" : "outline"
              }
              onClick={() =>
                runAction(
                  () => reactShopAction(shop.code, "like"),
                  "Đã gửi phản hồi tích cực.",
                  "Không thể gửi phản hồi."
                )
              }
            >
              <ThumbsUpIcon /> <span className="sr-only">Thích cửa hàng</span>
            </Button>
            <Button
              disabled={isPending}
              variant={
                shop.viewer.reaction === "dislike" ? "secondary" : "outline"
              }
              onClick={() =>
                runAction(
                  () => reactShopAction(shop.code, "dislike"),
                  "Đã ghi nhận phản hồi.",
                  "Không thể gửi phản hồi."
                )
              }
            >
              <ThumbsDownIcon />{" "}
              <span className="sr-only">Không thích cửa hàng</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Đánh giá sản phẩm</CardTitle>
          <CardDescription>
            Chia sẻ trải nghiệm để giúp cộng đồng mua sắm tốt hơn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canReview ? (
            <ReviewProductForm
              productSlug={product.slug}
              shopCode={shop.code}
            />
          ) : (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Bạn cần đặt sản phẩm này trước khi đánh giá.
            </p>
          )}
          <Separator />
          <Button
            className="w-full"
            disabled={isPending || !hasReview}
            type="button"
            variant="ghost"
            onClick={() =>
              runAction(
                () => deleteReviewAction(shop.code, product.slug),
                "Đã xoá đánh giá của bạn.",
                "Không thể xoá đánh giá."
              )
            }
          >
            <PaperclipIcon /> Xoá đánh giá hiện tại
          </Button>
        </CardContent>
      </Card>
      <ProductOrderDialog
        key={`${product.id}:${selectedVariant?.id ?? "base"}`}
        open={orderOpen}
        onOpenChange={setOrderOpen}
        shop={shop}
        product={product}
        variant={selectedVariant}
        regularPrice={regularPrice}
        stock={displayedStock}
        onMessage={openProductChat}
        messagePending={isChatPending}
        initialDiscountCode={initialDiscountCode}
      />
    </div>
  )
}
