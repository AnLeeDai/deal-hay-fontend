"use client"

import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxesIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  LayoutDashboardIcon,
  MessageSquareTextIcon,
  PackageIcon,
  ReceiptTextIcon,
  SettingsIcon,
  StoreIcon,
  TicketPercentIcon,
  Trash2Icon,
  TrendingUpIcon,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormDateTimePicker } from "@/components/form-date-time-picker"
import { FormSelect } from "@/components/form-select"
import { FormSubmitButton } from "@/components/form-submit-button"
import { AddressFields } from "@/components/address-fields"
import { PageHeader } from "@/components/layout/page-header"
import { MediaImage } from "@/components/media-image"
import { SelectedFilePreview } from "@/components/selected-file-preview"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserAvatar } from "@/components/user-avatar"
import {
  appendOptionalFile,
  applyServerErrors,
  runUploadAction,
} from "@/lib/form-utils"
import { formatCurrency, formatDate } from "@/lib/format"
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/validation"
import { prepareImageUploads } from "@/lib/image-upload"
import type { User } from "@/types/auth"
import type {
  InventoryMovement,
  ShopCategory,
  ShopCoupon,
  ShopMetrics,
  ShopOrder,
  ShopProduct,
  ShopProductReview,
} from "@/types/shop"
import {
  updateShopAvatarAction,
  updateShopProfileAction,
} from "@/modules/profile/actions"
import {
  avatarSchema,
  updateShopProfileSchema,
  type AvatarValues,
  type UpdateShopProfileValues,
} from "@/modules/profile/schemas/profile"
import {
  adjustInventoryAction,
  createCouponAction,
  deleteCouponAction,
  deleteProductAction,
  reorderCategoriesAction,
  replyReviewAction,
  toggleProductStatusAction,
  updateOrderStatusAction,
} from "@/modules/shop-management/actions"
import {
  adjustInventorySchema,
  createCouponSchema,
  replyReviewSchema,
  type AdjustInventoryValues,
  type CreateCouponValues,
  type ReplyReviewValues,
} from "@/modules/shop-management/schemas/shop-management"
import { CreateProductForm } from "@/modules/shop-management/components/create-product-form"
import { ProductPricingForm } from "@/modules/shop-management/components/product-pricing-form"

function ProductInventoryForm({ product }: { product: ShopProduct }) {
  const [isPending, startTransition] = useTransition()
  const availableVariants = product.variants.filter(
    (variant) => variant.is_active && !variant.retired_at
  )
  const defaultVariantId = product.has_variants
    ? (availableVariants.find((variant) => variant.is_default)?.id ??
      availableVariants[0]?.id ??
      "")
    : ""
  const form = useForm<AdjustInventoryValues>({
    resolver: zodResolver(adjustInventorySchema),
    defaultValues: {
      quantity_delta: 0,
      note: "",
      shop_product_variant_id: defaultVariantId,
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await adjustInventoryAction(product.id, values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset({
          quantity_delta: 0,
          note: "",
          shop_product_variant_id: defaultVariantId,
        })
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        {product.has_variants ? (
          <FormField
            control={form.control}
            name="shop_product_variant_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Biến thể sản phẩm</FormLabel>
                <FormSelect
                  disabled={availableVariants.length === 0}
                  inputRef={field.ref}
                  name={field.name}
                  options={availableVariants.map((variant) => {
                    const optionLabel = Object.values(variant.option_values)
                      .filter(Boolean)
                      .join(" / ")

                    return {
                      label: `${variant.variant_label || optionLabel || variant.sku} — tồn ${variant.stock}`,
                      value: variant.id,
                    }
                  })}
                  placeholder="Không có biến thể đang hoạt động"
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name="quantity_delta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số lượng +/-</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    type="number"
                    {...field}
                    value={Number.isFinite(field.value) ? field.value : ""}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? Number.NaN
                          : Number(event.target.value)
                      )
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
                  <Input
                    placeholder="Ghi chú điều chỉnh"
                    type="text"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {product.has_variants
              ? "Tổng tồn kho sản phẩm"
              : "Tồn kho hiện tại"}
            : {product.stock}
          </p>
          <FormSubmitButton
            disabled={product.has_variants && availableVariants.length === 0}
            idleText="Cập nhật tồn kho"
            pending={isPending}
            pendingText="Đang lưu..."
          />
        </div>
      </form>
    </Form>
  )
}

function ReviewReplyForm({ review }: { review: ShopProductReview }) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<ReplyReviewValues>({
    resolver: zodResolver(replyReviewSchema),
    defaultValues: {
      reply: review.shop_reply ?? "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await replyReviewAction(review.id, values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <AccordionItem
      className="rounded-xl border px-4"
      value={`review-${review.id}`}
    >
      <AccordionTrigger className="items-center py-3 hover:no-underline">
        <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <MediaImage
            alt={review.product.name}
            className="size-12 shrink-0 rounded-md border"
            fallbackLabel="Chưa có ảnh"
            sizes="48px"
            src={review.product.image_url}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {review.product.name}
            </span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {review.customer.name}: {review.content}
            </span>
          </span>
          <Badge
            className="mr-2"
            variant={review.shop_reply ? "secondary" : "outline"}
          >
            {review.shop_reply ? "Đã phản hồi" : "Chưa phản hồi"}
          </Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-muted p-3">
          <UserAvatar
            name={review.customer.name}
            size="sm"
            src={review.customer.avatar_url}
          />
          <div>
            <p className="font-medium">{review.customer.name}</p>
            <p className="mt-1 text-muted-foreground">{review.content}</p>
          </div>
        </div>
        {review.image_url ? (
          <MediaImage
            alt={`Ảnh đánh giá của ${review.customer.name}`}
            className="aspect-video w-full max-w-md rounded-lg border"
            fallbackLabel="Không thể tải ảnh đánh giá"
            sizes="(max-width: 768px) 100vw, 480px"
            src={review.image_url}
          />
        ) : null}
        <Form {...form}>
          <form className="space-y-3" noValidate onSubmit={onSubmit}>
            <FormField
              control={form.control}
              name="reply"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phản hồi từ shop</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Nhập phản hồi..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormSubmitButton
              idleText={
                review.shop_reply ? "Cập nhật phản hồi" : "Gửi phản hồi"
              }
              pending={isPending}
              pendingText="Đang lưu..."
              variant="outline"
            />
          </form>
        </Form>
      </AccordionContent>
    </AccordionItem>
  )
}

function ShopAvatarForm({ user }: { user: User }) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<AvatarValues>({
    resolver: zodResolver(avatarSchema),
    defaultValues: { avatar: undefined },
  })

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData()
    appendOptionalFile(formData, "avatar", values.avatar)

    startTransition(async () => {
      const state = await runUploadAction(async () =>
        updateShopAvatarAction(await prepareImageUploads(formData, "avatar"))
      )
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset({ avatar: undefined })
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
      <UserAvatar
        className="size-20"
        name={user.shop_name ?? user.full_name}
        size="lg"
        src={user.shop_avatar_url}
      />
      <Form {...form}>
        <form className="space-y-3" noValidate onSubmit={onSubmit}>
          <FormField
            control={form.control}
            name="avatar"
            render={({ field: { onChange, value, ...field } }) => (
              <FormItem>
                <FormLabel>Ảnh đại diện shop</FormLabel>
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
            idleText="Cập nhật ảnh shop"
            pending={isPending}
            pendingText="Đang tải lên..."
          />
        </form>
      </Form>
    </div>
  )
}

function ShopProfileForm({ user }: { user: User }) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<UpdateShopProfileValues>({
    resolver: zodResolver(updateShopProfileSchema),
    defaultValues: {
      shop_name: user.shop_name ?? "",
      shop_email: user.shop_email ?? "",
      shop_phone_number: user.shop_phone_number ?? "",
      shop_province: user.shop_province ?? "",
      shop_ward: user.shop_ward ?? "",
      shop_address_detail: user.shop_address_detail ?? "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await updateShopProfileAction(values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="shop_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên shop</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shop_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email shop</FormLabel>
                <FormControl>
                  <Input inputMode="email" type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shop_phone_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số điện thoại shop</FormLabel>
                <FormControl>
                  <Input inputMode="tel" type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <AddressFields
            form={form}
            provinceName="shop_province"
            wardName="shop_ward"
          />
          <FormField
            control={form.control}
            name="shop_address_detail"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Địa chỉ chi tiết</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormSubmitButton
          idleText="Lưu thông tin shop"
          pending={isPending}
          pendingText="Đang lưu..."
        />
      </form>
    </Form>
  )
}

function CreateCouponForm() {
  const [isPending, startTransition] = useTransition()
  const form = useForm<CreateCouponValues>({
    resolver: zodResolver(createCouponSchema),
    defaultValues: {
      code: "",
      name: "",
      discount_type: "fixed",
      discount_value: 1,
      minimum_order_amount: 0,
      maximum_discount_amount: undefined,
      usage_limit: undefined,
      starts_at: "",
      ends_at: "",
      is_active: true,
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await createCouponAction(values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset({
          code: "",
          name: "",
          discount_type: "fixed",
          discount_value: 1,
          minimum_order_amount: 0,
          maximum_discount_amount: undefined,
          usage_limit: undefined,
          starts_at: "",
          ends_at: "",
          is_active: true,
        })
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mã coupon</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên hiển thị</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="discount_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loại giảm giá</FormLabel>
                <FormSelect
                  inputRef={field.ref}
                  name={field.name}
                  options={[
                    { label: "Số tiền cố định", value: "fixed" },
                    { label: "Phần trăm", value: "percent" },
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
            name="discount_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Giá trị giảm</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    type="number"
                    {...field}
                    value={Number.isFinite(field.value) ? field.value : ""}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? Number.NaN
                          : Number(event.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="minimum_order_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Đơn tối thiểu</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    type="number"
                    {...field}
                    value={Number.isFinite(field.value) ? field.value : ""}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? Number.NaN
                          : Number(event.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="usage_limit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Giới hạn sử dụng</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    type="number"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? undefined
                          : Number(event.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maximum_discount_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Giảm tối đa</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    placeholder="Không giới hạn"
                    type="number"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? undefined
                          : Number(event.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="starts_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bắt đầu</FormLabel>
                <FormDateTimePicker
                  placeholder="Chọn ngày bắt đầu"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ends_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kết thúc</FormLabel>
                <FormDateTimePicker
                  placeholder="Chọn ngày kết thúc"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="items-center">
                <Checkbox
                  checked={field.value}
                  onBlur={field.onBlur}
                  onCheckedChange={field.onChange}
                />
                <span>Kích hoạt ngay</span>
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormSubmitButton
          idleText="Tạo coupon"
          pending={isPending}
          pendingText="Đang tạo..."
        />
      </form>
    </Form>
  )
}

const orderStatusLabels: Record<ShopOrder["status"], string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  processing: "Đang chuẩn bị",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
}

const orderActionLabels: Partial<Record<ShopOrder["status"], string>> = {
  confirmed: "Xác nhận đơn",
  processing: "Bắt đầu chuẩn bị",
  shipping: "Bắt đầu giao hàng",
  completed: "Hoàn thành đơn",
}

const orderStatusTransitions: Record<
  ShopOrder["status"],
  ShopOrder["status"][]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipping", "cancelled"],
  shipping: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
}

function mutationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function ProductListItem({ product }: { product: ShopProduct }) {
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const toggleStatus = () => {
    startTransition(async () => {
      try {
        const state = await toggleProductStatusAction(
          product.id,
          !product.is_active
        )
        if (state.success) {
          toast.success(state.message)
        } else {
          toast.error(state.message)
        }
      } catch (error) {
        toast.error(
          mutationErrorMessage(error, "Không thể cập nhật trạng thái sản phẩm.")
        )
      }
    })
  }

  const deleteProduct = () => {
    startTransition(async () => {
      try {
        const state = await deleteProductAction(product.id)
        if (state.success) {
          setDeleteOpen(false)
          toast.success(state.message)
        } else {
          toast.error(state.message)
        }
      } catch (error) {
        toast.error(mutationErrorMessage(error, "Không thể xoá sản phẩm."))
      }
    })
  }

  return (
    <div className="grid min-w-0 gap-3 overflow-hidden rounded-xl border p-3">
      <div className="flex min-w-0 gap-3">
        <MediaImage
          alt={product.name}
          className="size-16 shrink-0 rounded-lg border"
          fallbackLabel="Chưa có ảnh"
          sizes="64px"
          src={product.image_url}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-start gap-2">
            <p className="line-clamp-2 min-w-0 flex-1 font-medium break-words">
              {product.name}
            </p>
            <Badge
              className="shrink-0"
              variant={product.is_active ? "default" : "outline"}
            >
              {product.is_active ? "Đang hiển thị" : "Đang ẩn"}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            <span className="min-w-0 truncate">{product.category}</span>
            <span aria-hidden>•</span>
            <span>{formatCurrency(product.price)}</span>
            <span aria-hidden>•</span>
            <span>tồn {product.stock}</span>
          </div>
          {product.sku ? (
            <p
              className="mt-1 truncate text-xs text-muted-foreground"
              title={product.sku}
            >
              SKU: {product.sku}
            </p>
          ) : null}
        </div>
      </div>
      <ProductPricingForm product={product} />
      <div className="grid grid-cols-2 gap-2 border-t pt-3">
        <Button
          className="w-full"
          disabled={isPending}
          size="sm"
          variant="outline"
          onClick={toggleStatus}
        >
          {product.is_active ? "Ẩn sản phẩm" : "Mở bán lại"}
        </Button>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger
            render={
              <Button
                className="w-full"
                disabled={isPending}
                size="sm"
                variant="destructive"
              />
            }
          >
            <Trash2Icon /> Xoá
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <Trash2Icon />
              </AlertDialogMedia>
              <AlertDialogTitle>Xoá sản phẩm?</AlertDialogTitle>
              <AlertDialogDescription>
                Sản phẩm “{product.name}” sẽ bị xoá khỏi cửa hàng. Sản phẩm đã
                phát sinh đơn hàng có thể không xoá được.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Huỷ</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                variant="destructive"
                onClick={deleteProduct}
              >
                {isPending ? "Đang xoá..." : "Xoá sản phẩm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

const productsPerPage = 5
const inventoryMovementsPerPage = 4

function visiblePages(currentPage: number, totalPages: number) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
  const visiblePages = pages.filter(
    (page) =>
      page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
  )

  return visiblePages.flatMap<number | string>((page, index) => {
    const previousPage = visiblePages[index - 1]

    if (previousPage && page - previousPage > 1) {
      return [`ellipsis-${previousPage}-${page}`, page]
    }

    return [page]
  })
}

function ListPagination({
  currentPage,
  label,
  totalPages,
  onPageChange,
}: {
  currentPage: number
  label: string
  totalPages: number
  onPageChange: (page: number) => void
}) {
  return (
    <Pagination aria-label={label}>
      <PaginationContent className="flex-wrap">
        <PaginationItem>
          <Button
            aria-label="Trang trước"
            disabled={currentPage === 1}
            size="icon-sm"
            variant="outline"
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeftIcon />
          </Button>
        </PaginationItem>
        {visiblePages(currentPage, totalPages).map((page) => (
          <PaginationItem key={page}>
            {typeof page === "number" ? (
              <Button
                aria-current={page === currentPage ? "page" : undefined}
                aria-label={`Trang ${page}`}
                size="icon-sm"
                variant={page === currentPage ? "default" : "ghost"}
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            ) : (
              <PaginationEllipsis className="size-8" />
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <Button
            aria-label="Trang sau"
            disabled={currentPage === totalPages}
            size="icon-sm"
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

function ProductList({ products }: { products: ShopProduct[] }) {
  const [selectedPage, setSelectedPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(products.length / productsPerPage))
  const currentPage = Math.min(selectedPage, totalPages)
  const firstProductIndex = (currentPage - 1) * productsPerPage
  const visibleProducts = products.slice(
    firstProductIndex,
    firstProductIndex + productsPerPage
  )

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Shop chưa có sản phẩm nào.
      </p>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {visibleProducts.map((product) => (
          <ProductListItem key={product.id} product={product} />
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="space-y-3 border-t pt-4">
          <p className="text-center text-xs text-muted-foreground">
            Hiển thị {firstProductIndex + 1}–
            {Math.min(firstProductIndex + productsPerPage, products.length)}{" "}
            trên {products.length} sản phẩm
          </p>
          <ListPagination
            currentPage={currentPage}
            label="Phân trang danh sách sản phẩm"
            totalPages={totalPages}
            onPageChange={setSelectedPage}
          />
        </div>
      ) : null}
    </>
  )
}

function InventoryMovementList({
  movements,
}: {
  movements: InventoryMovement[]
}) {
  const [selectedPage, setSelectedPage] = useState(1)
  const totalPages = Math.max(
    1,
    Math.ceil(movements.length / inventoryMovementsPerPage)
  )
  const currentPage = Math.min(selectedPage, totalPages)
  const firstMovementIndex = (currentPage - 1) * inventoryMovementsPerPage
  const visibleMovements = movements.slice(
    firstMovementIndex,
    firstMovementIndex + inventoryMovementsPerPage
  )

  if (movements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Chưa có lịch sử tồn kho.</p>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {visibleMovements.map((movement) => (
          <div
            key={movement.id}
            className="min-w-0 overflow-hidden rounded-lg border p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 min-w-0 flex-1 font-medium break-words">
                {movement.product_name}
              </p>
              <Badge
                className="shrink-0"
                variant={movement.quantity_delta > 0 ? "secondary" : "outline"}
              >
                {movement.quantity_delta > 0 ? "+" : ""}
                {movement.quantity_delta}
              </Badge>
            </div>
            <p className="mt-1 break-words text-muted-foreground">
              {movement.variant_name || "Sản phẩm tiêu chuẩn"} • tồn sau điều
              chỉnh {movement.stock_after}
            </p>
            <p className="mt-1 line-clamp-2 text-xs break-words text-muted-foreground">
              {movement.note ?? "Không có ghi chú"} •{" "}
              {formatDate(movement.created_at)}
            </p>
          </div>
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="space-y-3 border-t pt-4">
          <p className="text-center text-xs text-muted-foreground">
            Hiển thị {firstMovementIndex + 1}–
            {Math.min(
              firstMovementIndex + inventoryMovementsPerPage,
              movements.length
            )}{" "}
            trên {movements.length} lần điều chỉnh
          </p>
          <ListPagination
            currentPage={currentPage}
            label="Phân trang lịch sử tồn kho"
            totalPages={totalPages}
            onPageChange={setSelectedPage}
          />
        </div>
      ) : null}
    </>
  )
}

function CouponListItem({ coupon }: { coupon: ShopCoupon }) {
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const discount =
    coupon.discount_type === "percent"
      ? `${coupon.discount_value}%`
      : formatCurrency(coupon.discount_value)

  const deleteCoupon = () => {
    startTransition(async () => {
      try {
        const state = await deleteCouponAction(coupon.id)
        if (state.success) {
          setDeleteOpen(false)
          toast.success(state.message)
        } else {
          toast.error(state.message)
        }
      } catch (error) {
        toast.error(mutationErrorMessage(error, "Không thể xoá coupon."))
      }
    })
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{coupon.code}</p>
            <Badge variant={coupon.is_active ? "default" : "outline"}>
              {coupon.is_active ? "Đang hoạt động" : "Đang tắt"}
            </Badge>
          </div>
          <p className="mt-1 text-sm">{coupon.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Giảm {discount} • đơn tối thiểu{" "}
            {formatCurrency(coupon.minimum_order_amount)} • đã dùng{" "}
            {coupon.used_count}
            {coupon.usage_limit ? `/${coupon.usage_limit}` : " lần"}
          </p>
          {coupon.starts_at || coupon.ends_at ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Hiệu lực: {formatDate(coupon.starts_at)} –{" "}
              {formatDate(coupon.ends_at)}
            </p>
          ) : null}
        </div>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger
            render={<Button disabled={isPending} variant="destructive" />}
          >
            <Trash2Icon /> Xoá
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <Trash2Icon />
              </AlertDialogMedia>
              <AlertDialogTitle>Xoá coupon?</AlertDialogTitle>
              <AlertDialogDescription>
                Coupon “{coupon.code}” sẽ không còn được áp dụng cho đơn hàng
                mới.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Huỷ</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                variant="destructive"
                onClick={deleteCoupon}
              >
                {isPending ? "Đang xoá..." : "Xoá coupon"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

function OrderCard({ order }: { order: ShopOrder }) {
  const [isPending, startTransition] = useTransition()
  const [cancelOpen, setCancelOpen] = useState(false)
  const nextStatuses = orderStatusTransitions[order.status]
  const nextStatus = nextStatuses.find((status) => status !== "cancelled")
  const canCancel = nextStatuses.includes("cancelled")

  const updateStatus = (status: ShopOrder["status"]) => {
    startTransition(async () => {
      try {
        const state = await updateOrderStatusAction(order.id, status)
        if (state.success) {
          if (status === "cancelled") setCancelOpen(false)
          toast.success(state.message)
        } else {
          toast.error(state.message)
        }
      } catch (error) {
        toast.error(
          mutationErrorMessage(error, "Không thể cập nhật trạng thái đơn hàng.")
        )
      }
    })
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{order.order_number}</p>
            <Badge
              variant={
                order.status === "cancelled"
                  ? "destructive"
                  : order.status === "completed"
                    ? "default"
                    : "secondary"
              }
            >
              {orderStatusLabels[order.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.customer_name} • {order.customer_phone}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {order.items.length} sản phẩm • {formatDate(order.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <p className="mr-2 text-base font-semibold">
            {formatCurrency(order.total)}
          </p>
          {nextStatus ? (
            <Button
              disabled={isPending}
              onClick={() => updateStatus(nextStatus)}
            >
              {orderActionLabels[nextStatus] ?? orderStatusLabels[nextStatus]}
            </Button>
          ) : null}
          {canCancel ? (
            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <AlertDialogTrigger
                render={<Button disabled={isPending} variant="outline" />}
              >
                Huỷ đơn
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Huỷ đơn hàng?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Đơn {order.order_number} sẽ bị huỷ, tồn kho và lượt sử dụng
                    coupon liên quan sẽ được hoàn lại.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>
                    Quay lại
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isPending}
                    variant="destructive"
                    onClick={() => updateStatus("cancelled")}
                  >
                    {isPending ? "Đang huỷ..." : "Xác nhận huỷ"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      <Accordion className="mt-3">
        <AccordionItem value={`order-${order.id}`}>
          <AccordionTrigger className="py-3 hover:no-underline">
            Chi tiết giao hàng và sản phẩm
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Địa chỉ giao hàng
              </p>
              <p className="mt-1">{order.shipping_address}</p>
              {order.note ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Ghi chú: {order.note}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variant_name || "Sản phẩm tiêu chuẩn"} • SL{" "}
                      {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium">
                    {formatCurrency(item.subtotal)}
                  </p>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

export function ShopManagementClient({
  user,
  categories,
  products,
  coupons,
  orders,
  metrics,
  inventoryMovements,
  productReviews,
}: {
  user: User
  categories: ShopCategory[]
  products: ShopProduct[]
  coupons: ShopCoupon[]
  orders: ShopOrder[]
  metrics?: ShopMetrics
  inventoryMovements: InventoryMovement[]
  productReviews: ShopProductReview[]
}) {
  const [pending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState("overview")
  const [orderedCategories, setOrderedCategories] = useState(
    categories.map((category) => category.id)
  )
  const categoryOrderHasChanged =
    orderedCategories.length !== categories.length ||
    orderedCategories.some(
      (categoryId, index) => categoryId !== categories[index]?.id
    )
  const summaryMetrics = [
    {
      label: "Sản phẩm đang bán",
      value: metrics?.products_count ?? products.length,
      icon: PackageIcon,
    },
    {
      label: "Đơn hàng",
      value: metrics?.total_orders_count ?? orders.length,
      icon: ReceiptTextIcon,
    },
    {
      label: "Doanh thu",
      value: formatCurrency(metrics?.total_revenue ?? 0),
      icon: TrendingUpIcon,
    },
    {
      label: "Tổng tồn kho",
      value:
        metrics?.total_stock ??
        products.reduce((total, product) => total + product.stock, 0),
      icon: BoxesIcon,
    },
  ]

  const moveCategory = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= orderedCategories.length) return
    const next = [...orderedCategories]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    setOrderedCategories(next)
  }

  const openProductTab = () => {
    setActiveTab("products")
    requestAnimationFrame(() => {
      const heading = document.getElementById("create-product-heading")
      heading?.scrollIntoView({ behavior: "smooth", block: "start" })
      heading?.focus({ preventScroll: true })
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Kênh người bán"
        description="Theo dõi hoạt động kinh doanh, quản lý sản phẩm, đơn hàng và trải nghiệm khách hàng."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={openProductTab}>
              <PackageIcon /> Đăng sản phẩm
            </Button>
            <Button
              nativeButton={false}
              render={<Link href={`/shops/${user.user_code}`} />}
              variant="outline"
            >
              <ExternalLinkIcon /> Xem cửa hàng
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full">
          <div className="w-max min-w-full pb-3">
            <TabsList className="h-auto w-full justify-start p-1">
              <TabsTrigger className="min-w-28" value="overview">
                <LayoutDashboardIcon /> Tổng quan
              </TabsTrigger>
              <TabsTrigger className="min-w-28" value="products">
                <PackageIcon /> Sản phẩm
              </TabsTrigger>
              <TabsTrigger className="min-w-28" value="inventory">
                <BoxesIcon /> Kho hàng
              </TabsTrigger>
              <TabsTrigger className="min-w-28" value="orders">
                <ReceiptTextIcon /> Đơn hàng
              </TabsTrigger>
              <TabsTrigger className="min-w-28" value="promotions">
                <TicketPercentIcon /> Khuyến mãi
              </TabsTrigger>
              <TabsTrigger className="min-w-28" value="reviews">
                <MessageSquareTextIcon /> Đánh giá
              </TabsTrigger>
              <TabsTrigger className="min-w-28" value="settings">
                <SettingsIcon /> Cửa hàng
              </TabsTrigger>
            </TabsList>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent className="space-y-6 pt-4" value="overview">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryMetrics.map((metric) => (
              <Card key={metric.label} size="sm">
                <CardContent className="flex-row items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <metric.icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="text-base font-semibold break-words sm:text-lg">
                      {metric.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StoreIcon className="size-5 text-primary" />{" "}
                  {user.shop_name ?? "Cửa hàng của bạn"}
                </CardTitle>
                <CardDescription>
                  Các chỉ số về khách hàng và hiệu quả vận hành.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-xs text-muted-foreground">
                    Người theo dõi
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {metrics?.followers_count ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-xs text-muted-foreground">
                    Tỷ lệ hài lòng
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {metrics?.satisfaction_rate === null ||
                    metrics?.satisfaction_rate === undefined
                      ? "—"
                      : `${metrics.satisfaction_rate}%`}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-xs text-muted-foreground">
                    Hội thoại khách hàng
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {metrics?.customer_conversations_count ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-xs text-muted-foreground">
                    Tỷ lệ phản hồi
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {metrics?.response_rate === null ||
                    metrics?.response_rate === undefined
                      ? "—"
                      : `${metrics.response_rate}%`}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Công việc cần xử lý</CardTitle>
                <CardDescription>
                  Những mục nên được ưu tiên trong phiên làm việc này.
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-3">
                {[
                  {
                    label: "Đơn hàng đang mở",
                    value: metrics?.open_orders_count ?? 0,
                    hint: "Xử lý trong tab Đơn hàng",
                    tab: "orders",
                  },
                  {
                    label: "Đánh giá gần đây chưa phản hồi",
                    value: productReviews.filter((review) => !review.shop_reply)
                      .length,
                    hint: "Phản hồi trong tab Đánh giá",
                    tab: "reviews",
                  },
                  {
                    label: "Sản phẩm đang ẩn",
                    value: metrics?.hidden_products_count ?? 0,
                    hint: "Kiểm tra trong tab Sản phẩm",
                    tab: "products",
                  },
                  {
                    label: "Coupon đang hoạt động",
                    value: metrics?.active_coupons_count ?? 0,
                    hint: "Quản lý trong tab Khuyến mãi",
                    tab: "promotions",
                  },
                ].map((item) => (
                  <Button
                    key={item.label}
                    className="h-auto w-full justify-between gap-4 p-3 text-left whitespace-normal"
                    variant="outline"
                    onClick={() => setActiveTab(item.tab)}
                  >
                    <div className="min-w-0 flex-1">
                      <p>{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.hint}
                      </p>
                    </div>
                    <span className="text-xl font-semibold">{item.value}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent className="space-y-6 pt-4" value="settings">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Thông tin cửa hàng</CardTitle>
                <CardDescription>
                  Cập nhật ảnh đại diện và thông tin hiển thị công khai.
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-8">
                <ShopAvatarForm user={user} />
                <ShopProfileForm user={user} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trưng bày danh mục</CardTitle>
                <CardDescription>
                  Sắp xếp thứ tự danh mục trên trang cửa hàng.
                </CardDescription>
                {categoryOrderHasChanged ? (
                  <CardAction>
                    <Badge variant="secondary">Chưa lưu</Badge>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="gap-2">
                {orderedCategories.map((categoryId, index) => {
                  const category = categories.find(
                    (item) => item.id === categoryId
                  )
                  if (!category) return null
                  return (
                    <div
                      key={category.id}
                      className="flex items-center gap-3 rounded-lg border p-2.5"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                        {index + 1}
                      </span>
                      <p className="min-w-0 flex-1 truncate font-medium">
                        {category.name}
                      </p>
                      <ButtonGroup>
                        <Button
                          aria-label={`Đưa ${category.name} lên trên`}
                          disabled={pending || index === 0}
                          size="icon-sm"
                          variant="outline"
                          onClick={() => moveCategory(index, -1)}
                        >
                          <ArrowUpIcon />
                        </Button>
                        <Button
                          aria-label={`Đưa ${category.name} xuống dưới`}
                          disabled={
                            pending || index === orderedCategories.length - 1
                          }
                          size="icon-sm"
                          variant="outline"
                          onClick={() => moveCategory(index, 1)}
                        >
                          <ArrowDownIcon />
                        </Button>
                      </ButtonGroup>
                    </div>
                  )
                })}
                {orderedCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Chưa có danh mục hoạt động.
                  </p>
                ) : null}
              </CardContent>
              <CardFooter className="justify-end gap-2 border-t pt-4">
                <Button
                  disabled={pending || !categoryOrderHasChanged}
                  variant="outline"
                  onClick={() =>
                    setOrderedCategories(
                      categories.map((category) => category.id)
                    )
                  }
                >
                  Đặt lại
                </Button>
                <Button
                  disabled={
                    pending ||
                    !categoryOrderHasChanged ||
                    orderedCategories.length === 0
                  }
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        const state =
                          await reorderCategoriesAction(orderedCategories)
                        if (state.success) {
                          toast.success(state.message)
                        } else {
                          toast.error(state.message)
                        }
                      } catch (error) {
                        toast.error(
                          mutationErrorMessage(
                            error,
                            "Không thể sắp xếp danh mục."
                          )
                        )
                      }
                    })
                  }
                >
                  {pending ? "Đang lưu..." : "Lưu thứ tự"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent className="space-y-6 pt-4" value="products">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle
                  id="create-product-heading"
                  role="heading"
                  tabIndex={-1}
                  aria-level={2}
                >
                  Đăng sản phẩm mới
                </CardTitle>
                <CardDescription>
                  Tải ảnh và nhập thông tin để đưa sản phẩm lên cửa hàng.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreateProductForm categories={categories} />
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Danh sách sản phẩm</CardTitle>
                <CardDescription>
                  Quản lý trạng thái và thông tin cơ bản của sản phẩm.
                </CardDescription>
                <CardAction>
                  <Badge variant="secondary">{products.length} sản phẩm</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="gap-4">
                <ProductList products={products} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent className="space-y-6 pt-4" value="inventory">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Điều chỉnh tồn kho</CardTitle>
                <CardDescription>
                  Chọn sản phẩm hoặc biến thể cần nhập thêm hay xuất bớt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion className="gap-3" multiple>
                  {products.map((product) => (
                    <AccordionItem
                      key={product.id}
                      className="rounded-xl border px-4"
                      value={`inventory-${product.id}`}
                    >
                      <AccordionTrigger className="min-w-0 items-center gap-2 py-3 hover:no-underline">
                        <span className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden pr-1 text-left">
                          <MediaImage
                            alt={product.name}
                            className="size-12 shrink-0 rounded-md border"
                            fallbackLabel="Chưa có ảnh"
                            sizes="48px"
                            src={product.image_url}
                          />
                          <span className="min-w-0 flex-1 overflow-hidden">
                            <span className="line-clamp-2 block font-medium break-words">
                              {product.name}
                            </span>
                            <span className="block truncate text-xs font-normal text-muted-foreground">
                              Tồn hiện tại: {product.stock}
                              {product.has_variants ? " • Có biến thể" : ""}
                            </span>
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ProductInventoryForm product={product} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                {products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Chưa có sản phẩm để điều chỉnh tồn kho.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Lịch sử gần đây</CardTitle>
                <CardDescription>
                  Theo dõi tối đa 100 lần điều chỉnh mới nhất.
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-4">
                <InventoryMovementList movements={inventoryMovements} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent className="space-y-6 pt-4" value="promotions">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Tạo coupon</CardTitle>
                <CardDescription>
                  Thiết lập mức giảm, điều kiện và thời gian áp dụng.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreateCouponForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Danh sách coupon</CardTitle>
                <CardDescription>
                  Theo dõi các mã giảm giá đã tạo cho cửa hàng.
                </CardDescription>
                <CardAction>
                  <Badge variant="secondary">{coupons.length} coupon</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="gap-3">
                {coupons.map((coupon) => (
                  <CouponListItem key={coupon.id} coupon={coupon} />
                ))}
                {coupons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Chưa có coupon nào.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent className="space-y-6 pt-4" value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>Đánh giá sản phẩm</CardTitle>
              <CardDescription>
                Hiển thị tối đa 100 đánh giá gần nhất. Mở từng đánh giá để phản
                hồi hoặc cập nhật câu trả lời.
              </CardDescription>
              <CardAction>
                <Badge variant="secondary">
                  {productReviews.filter((review) => !review.shop_reply).length}{" "}
                  chưa phản hồi
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Accordion className="gap-3" multiple>
                {productReviews.map((review) => (
                  <ReviewReplyForm key={review.id} review={review} />
                ))}
              </Accordion>
              {productReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Cửa hàng chưa có đánh giá sản phẩm.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="space-y-6 pt-4" value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Đơn hàng</CardTitle>
              <CardDescription>
                Hiển thị tối đa 100 đơn gần nhất; mỗi đơn chỉ có các bước xử lý
                hợp lệ tiếp theo.
              </CardDescription>
              <CardAction>
                <Badge variant="secondary">{orders.length} đơn</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="gap-3">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có đơn hàng nào.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
