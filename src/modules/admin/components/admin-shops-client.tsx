"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { LockIcon, LockOpenIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormSubmitButton } from "@/components/form-submit-button"
import { DataPagination } from "@/components/layout/data-pagination"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { MediaImage } from "@/components/media-image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import { applyServerErrors } from "@/lib/form-utils"
import type { AdminShop } from "@/types/admin"
import type { PaginatedResponse } from "@/types/common"
import {
  deleteShopProductAction,
  toggleUserLockAction,
} from "@/modules/admin/actions"
import { AdminNavigation } from "@/modules/admin/components/admin-navigation"
import {
  deleteShopProductSchema,
  type DeleteShopProductValues,
} from "@/modules/admin/schemas/admin"

function ShopLockForm({ shop }: { shop: AdminShop }) {
  const [reason, setReason] = useState("")
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="space-y-2 rounded-lg border p-3"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          try {
            await toggleUserLockAction(
              shop.id,
              shop.is_active ? "lock" : "unlock",
              shop.is_active ? reason.trim() : undefined
            )
            setReason("")
            toast.success(
              shop.is_active ? "Đã khoá gian hàng." : "Đã mở khoá gian hàng."
            )
          } catch {
            toast.error("Không thể cập nhật trạng thái gian hàng.")
          }
        })
      }}
    >
      {shop.is_active ? (
        <>
          <Label htmlFor={`shop-lock-${shop.id}`}>Lý do khoá gian hàng</Label>
          <Textarea
            id={`shop-lock-${shop.id}`}
            maxLength={500}
            required
            disabled={pending}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Khoá gian hàng sẽ ẩn shop và tạm khoá tài khoản chủ shop.
          </p>
        </>
      ) : shop.lock_reason ? (
        <p>Lý do khoá: {shop.lock_reason}</p>
      ) : null}
      <Button
        disabled={pending || (shop.is_active && !reason.trim())}
        type="submit"
        variant={shop.is_active ? "destructive" : "outline"}
      >
        {shop.is_active ? <LockIcon /> : <LockOpenIcon />}
        {pending
          ? "Đang cập nhật..."
          : shop.is_active
            ? "Khoá gian hàng"
            : "Mở khoá gian hàng"}
      </Button>
    </form>
  )
}

function ShopProductDeleteForm({
  shopId,
  productId,
  productName,
}: {
  shopId: string
  productId: string
  productName: string
}) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<DeleteShopProductValues>({
    resolver: zodResolver(deleteShopProductSchema),
    defaultValues: {
      reason: "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await deleteShopProductAction(shopId, productId, values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset({ reason: "" })
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form
        className="space-y-2 rounded-lg border p-3"
        noValidate
        onSubmit={onSubmit}
      >
        <p className="font-medium">Xoá sản phẩm: {productName}</p>
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lý do xoá sản phẩm</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Lý do xoá sản phẩm này khỏi shop"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormSubmitButton
          idleText="Xoá sản phẩm"
          pending={isPending}
          pendingText="Đang xoá..."
          variant="destructive"
        />
      </form>
    </Form>
  )
}

export function AdminShopsClient({
  shops,
}: {
  shops: PaginatedResponse<AdminShop>
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Quản lý shop"
        description="Kiểm tra tình trạng cửa hàng, danh mục và sản phẩm đang kinh doanh."
      />
      <AdminNavigation />
      <div className="grid gap-4">
        {shops.data.map((shop) => (
          <Card key={shop.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={shop.shop_name ?? shop.full_name}
                  size="lg"
                  src={shop.shop_avatar_url ?? shop.avatar_url}
                />
                <div>
                  <CardTitle className="text-base">
                    {shop.shop_name ?? shop.full_name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {shop.shop_email ?? shop.email} • {shop.user_code}
                  </p>
                </div>
              </div>
              <Badge variant={shop.is_active ? "default" : "destructive"}>
                {shop.is_active ? "Đang hoạt động" : "Đã khoá"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ShopLockForm shop={shop} />
              <p>{shop.shop_address || "Chưa cập nhật địa chỉ shop."}</p>
              <p className="text-muted-foreground">
                {shop.products_count} sản phẩm • {shop.categories_count} danh
                mục
              </p>
              {(shop.products ?? []).map((product) => (
                <div
                  key={product.id}
                  className="grid gap-3 rounded-lg border p-3 md:grid-cols-[96px_1fr]"
                >
                  <MediaImage
                    alt={product.name}
                    className="aspect-square w-full rounded-md border"
                    fallbackLabel="Chưa có ảnh"
                    sizes="96px"
                    src={product.image_url}
                  />
                  <ShopProductDeleteForm
                    productId={product.id}
                    productName={product.name}
                    shopId={shop.id}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {shops.data.length === 0 ? (
          <EmptyState
            title="Chưa có dữ liệu cửa hàng"
            description="Các cửa hàng mới sẽ xuất hiện tại đây."
          />
        ) : null}
      </div>
      <DataPagination
        currentPage={shops.current_page}
        lastPage={shops.last_page}
      />
    </div>
  )
}
