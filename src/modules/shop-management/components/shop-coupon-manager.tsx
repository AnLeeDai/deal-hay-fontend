"use client"

import { useId, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CopyIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TicketPercentIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  saveShopCouponAction,
  removeShopCouponAction,
} from "@/modules/shop-management/coupon-actions"
import {
  shopCouponSchema,
  type ShopCouponValues,
} from "@/modules/shop-management/schemas/shop-coupon"
import { formatCurrency, formatDate } from "@/lib/format"
import type { ShopCoupon, ShopProduct } from "@/types/shop"

function localDate(value: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

function couponStatus(coupon: ShopCoupon): string {
  if (!coupon.is_active) return "Đang tắt"
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() <= Date.now())
    return "Đã hết hạn"
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit)
    return "Hết lượt"
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > Date.now())
    return "Sắp diễn ra"
  return "Đang áp dụng"
}

export function ShopCouponManager({
  coupons,
  products,
}: {
  coupons: ShopCoupon[]
  products: ShopProduct[]
}) {
  const router = useRouter()
  const prefix = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [editing, setEditing] = useState<ShopCoupon | null | undefined>(
    undefined
  )
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})
  const [pending, startTransition] = useTransition()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function openForm(coupon: ShopCoupon | null) {
    setEditing(coupon)
    setSelected(coupon?.product_ids ?? [])
    setErrors({})
    setSearch("")
    setDeleteId(null)
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    )
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const nullableNumber = (key: string) =>
      data.get(key) ? Number(data.get(key)) : null
    const isoDate = (key: string) =>
      data.get(key) ? new Date(String(data.get(key))).toISOString() : null
    const values: ShopCouponValues = {
      name: String(data.get("name") ?? ""),
      discount_type:
        data.get("discount_type") === "percent" ? "percent" : "fixed",
      discount_value: Number(data.get("discount_value")),
      minimum_order_amount: Number(data.get("minimum_order_amount") || 0),
      maximum_discount_amount: nullableNumber("maximum_discount_amount"),
      usage_limit: nullableNumber("usage_limit"),
      starts_at: isoDate("starts_at"),
      ends_at: isoDate("ends_at"),
      is_active: data.get("is_active") === "on",
      product_ids: selected,
    }
    const parsed = shopCouponSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors)
      return
    }
    setErrors({})
    startTransition(async () => {
      try {
        const result = await saveShopCouponAction(parsed.data, editing?.id)
        if (!result.success) {
          setErrors(result.errors ?? {})
          toast.error(result.message)
          return
        }
        toast.success(result.message)
        setEditing(undefined)
        router.refresh()
      } catch {
        toast.error("Kết nối bị gián đoạn. Vui lòng thử lưu lại.")
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        const result = await removeShopCouponAction(id)
        if (!result.success) return void toast.error(result.message)
        toast.success(result.message)
        setDeleteId(null)
        router.refresh()
      } catch {
        toast.error("Kết nối bị gián đoạn. Vui lòng thử xóa lại.")
      }
    })
  }

  const matching = products.filter((product) =>
    `${product.name} ${product.sku ?? ""}`
      .toLocaleLowerCase("vi")
      .includes(search.toLocaleLowerCase("vi"))
  )
  const error = (key: string) =>
    errors[key]?.[0] ? (
      <p className="text-sm text-destructive" role="alert">
        {errors[key]?.[0]}
      </p>
    ) : null
  const field = (
    name: string,
    label: string,
    defaultValue: string | number,
    type = "number",
    optional = false
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`${prefix}-${name}`}>{label}</Label>
      <Input
        id={`${prefix}-${name}`}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={!optional}
        min={
          type === "number"
            ? name === "minimum_order_amount"
              ? 0
              : 1
            : undefined
        }
        step={type === "number" ? 1 : undefined}
        aria-invalid={Boolean(errors[name])}
      />
      {error(name)}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Ưu đãi từ shop</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tạo ưu đãi, chọn sản phẩm áp dụng và theo dõi lượt sử dụng.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => openForm(null)}
          disabled={pending || products.length === 0}
        >
          <PlusIcon />
          Tạo ưu đãi
        </Button>
      </div>
      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Thêm sản phẩm vào cửa hàng để tạo ưu đãi.
        </p>
      ) : null}

      {editing !== undefined ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {editing ? "Chỉnh sửa ưu đãi" : "Tạo ưu đãi mới"}
            </CardTitle>
            <CardDescription>
              Mã coupon được hệ thống tự tạo và giữ cố định. Bạn chỉ cần đặt tên
              hiển thị dễ hiểu cho khách hàng.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              key={editing?.id ?? "new"}
              ref={formRef}
              onSubmit={save}
              className="space-y-6"
            >
              <fieldset disabled={pending} className="space-y-6">
                {editing ? (
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <span className="text-muted-foreground">Mã hệ thống: </span>
                    <code className="break-all">{editing.code}</code>
                  </div>
                ) : null}
                {field("name", "Tên hiển thị", editing?.name ?? "", "text")}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${prefix}-discount-type`}>
                      Hình thức giảm
                    </Label>
                    <select
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      id={`${prefix}-discount-type`}
                      name="discount_type"
                      defaultValue={editing?.discount_type ?? "fixed"}
                    >
                      <option value="fixed">Giảm số tiền (đ)</option>
                      <option value="percent">Giảm phần trăm (%)</option>
                    </select>
                  </div>
                  {field(
                    "discount_value",
                    "Giá trị giảm",
                    editing?.discount_value ?? ""
                  )}
                  {field(
                    "minimum_order_amount",
                    "Tiền hàng tối thiểu (đ)",
                    editing?.minimum_order_amount ?? 0
                  )}
                  {field(
                    "maximum_discount_amount",
                    "Giảm tối đa (đ, tùy chọn)",
                    editing?.maximum_discount_amount ?? "",
                    "number",
                    true
                  )}
                  {field(
                    "usage_limit",
                    "Tổng lượt sử dụng (tùy chọn)",
                    editing?.usage_limit ?? "",
                    "number",
                    true
                  )}
                  {field(
                    "starts_at",
                    "Bắt đầu (tùy chọn)",
                    localDate(editing?.starts_at ?? null),
                    "datetime-local",
                    true
                  )}
                  {field(
                    "ends_at",
                    "Kết thúc (tùy chọn)",
                    localDate(editing?.ends_at ?? null),
                    "datetime-local",
                    true
                  )}
                </div>
                <fieldset className="space-y-3">
                  <legend className="font-medium">
                    Sản phẩm áp dụng · Đã chọn {selected.length}
                  </legend>
                  <div className="relative">
                    <SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Tìm tên hoặc SKU sản phẩm"
                      aria-label="Tìm sản phẩm áp dụng ưu đãi"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() =>
                        setSelected((current) => [
                          ...new Set([
                            ...current,
                            ...matching.map((product) => product.id),
                          ]),
                        ])
                      }
                    >
                      Chọn tất cả kết quả
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground underline"
                      onClick={() => setSelected([])}
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-lg border">
                    {matching.map((product) => (
                      <label
                        key={product.id}
                        className="flex cursor-pointer items-center gap-3 border-b p-3 last:border-0 hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={selected.includes(product.id)}
                          onChange={(event) =>
                            setSelected((current) =>
                              event.target.checked
                                ? [...current, product.id]
                                : current.filter((id) => id !== product.id)
                            )
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {product.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {product.sku || "Chưa có SKU"} ·{" "}
                            {formatCurrency(product.price)}
                            {!product.is_active ? " · Đang ẩn" : ""}
                          </span>
                        </span>
                      </label>
                    ))}
                    {!matching.length ? (
                      <p className="p-4 text-sm text-muted-foreground">
                        Không có sản phẩm phù hợp.
                      </p>
                    ) : null}
                  </div>
                  {error("product_ids")}
                </fieldset>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_active"
                    className="size-4 accent-primary"
                    defaultChecked={editing?.is_active ?? true}
                  />
                  Bật ưu đãi để khách hàng có thể sử dụng
                </label>
                <div className="flex gap-3">
                  <Button type="submit">
                    {pending
                      ? "Đang lưu..."
                      : editing
                        ? "Lưu thay đổi"
                        : "Tạo ưu đãi và mã tự động"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(undefined)}
                  >
                    Hủy
                  </Button>
                </div>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {coupons.map((coupon) => (
          <Card key={coupon.id}>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{coupon.name}</h3>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    Giảm{" "}
                    {coupon.discount_type === "percent"
                      ? `${coupon.discount_value}%`
                      : formatCurrency(coupon.discount_value)}
                  </p>
                </div>
                <Badge
                  variant={
                    couponStatus(coupon) === "Đang áp dụng"
                      ? "default"
                      : "secondary"
                  }
                >
                  {couponStatus(coupon)}
                </Badge>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Tiền hàng từ {formatCurrency(coupon.minimum_order_amount)}
                  {coupon.maximum_discount_amount !== null
                    ? ` · Giảm tối đa ${formatCurrency(coupon.maximum_discount_amount)}`
                    : ""}
                </p>
                <p>
                  Áp dụng cho {coupon.product_ids?.length ?? 0} sản phẩm · Đã
                  dùng {coupon.used_count}
                  {coupon.usage_limit !== null
                    ? `/${coupon.usage_limit}`
                    : " lượt"}
                </p>
                <p>
                  {coupon.starts_at
                    ? `Từ ${formatDate(coupon.starts_at)}`
                    : "Bắt đầu ngay"}
                  {coupon.ends_at
                    ? ` · Đến ${formatDate(coupon.ends_at)}`
                    : " · Không giới hạn thời gian"}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
                <code
                  className="min-w-0 flex-1 truncate text-xs"
                  title={coupon.code}
                >
                  {coupon.code}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Sao chép mã ${coupon.name}`}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(coupon.code)
                      toast.success("Đã sao chép mã ưu đãi.")
                    } catch {
                      toast.error(
                        "Không sao chép được mã. Vui lòng chọn và sao chép mã."
                      )
                    }
                  }}
                >
                  <CopyIcon className="size-4" />
                </Button>
              </div>
              {deleteId === coupon.id ? (
                <div className="space-y-2 rounded-lg border border-destructive/30 p-3">
                  <p className="text-sm">
                    Xóa ưu đãi “{coupon.name}”? Ưu đãi đã có đơn hàng chỉ có thể
                    tắt.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => remove(coupon.id)}
                    >
                      {pending ? "Đang xóa..." : "Xác nhận xóa"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setDeleteId(null)}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => openForm(coupon)}
                  >
                    <PencilIcon />
                    Chỉnh sửa
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setDeleteId(coupon.id)}
                  >
                    <Trash2Icon />
                    Xóa
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {!coupons.length && editing === undefined && products.length > 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <TicketPercentIcon className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium">Chưa có ưu đãi từ shop</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tạo ưu đãi đầu tiên để khách dễ tìm và sử dụng khi đặt hàng.
          </p>
        </div>
      ) : null}
    </div>
  )
}
