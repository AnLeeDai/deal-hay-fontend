"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CopyIcon, RefreshCwIcon, TicketPercentIcon } from "lucide-react"
import { toast } from "sonner"
import { MediaImage } from "@/components/media-image"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import {
  loadDiscountCodesAction,
  saveDiscountCodeAction,
} from "@/modules/discount-codes/actions"
import type { ProductDiscountCode } from "@/types/discount-code"
import { formatDiscountCodeValue } from "@/modules/discount-codes/lib/format-discount-code"
import {
  discountCodeCanBeSaved,
  discountCodeProductHref,
} from "@/modules/discount-codes/lib/discount-codes"

export function DiscountCodesPageClient({
  codes: initialCodes,
}: {
  codes: ProductDiscountCode[]
}) {
  const [codes, setCodes] = useState(initialCodes)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const saveCode = (code: ProductDiscountCode, useNow = false) =>
    startTransition(async () => {
      const state = await saveDiscountCodeAction(code.id)
      if (!state.success || !state.data) {
        toast.error(state.message)
        return
      }
      const saved = state.data
      setCodes((items) =>
        items.map((item) => (item.id === saved.id ? saved : item))
      )
      toast.success(state.message)
      if (useNow && saved.is_available)
        router.push(discountCodeProductHref(saved))
      else if (useNow)
        toast.error(
          "Mã đã được lưu nhưng hiện chưa thể áp dụng cho sản phẩm này."
        )
    })
  const reload = () =>
    startTransition(async () => {
      const state = await loadDiscountCodesAction()
      if (!state.success || !state.data) {
        toast.error(state.message)
        return
      }
      setCodes(state.data)
    })

  return (
    <div className="space-y-7">
      <PageHeader
        title="Mã giảm giá của tôi"
        description="Quản lý các mã giảm giá đã nhận. Bạn có thể lưu mã và cộng nhiều mã cho cùng sản phẩm, giảm tiền hàng đến 0đ. Mỗi mã dùng một lần trong thời hạn ghi trên mã."
        actions={
          <Button variant="outline" disabled={pending} onClick={reload}>
            <RefreshCwIcon className={pending ? "animate-spin" : ""} /> Tải lại
          </Button>
        }
      />
      {codes.length === 0 ? (
        <EmptyState
          title="Bạn chưa có mã giảm giá"
          description="Các mã giảm giá của bạn sẽ xuất hiện tại đây để lưu và dùng cho lần mua tiếp theo."
          action={
            <Button nativeButton={false} render={<Link href="/" />}>
              Khám phá sản phẩm
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {codes.map((code) => (
            <Card key={code.id} className="gap-0 overflow-hidden py-0">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <MediaImage
                    src={code.product.image_url}
                    alt={code.product.name}
                    className="size-20 shrink-0 rounded-lg"
                    sizes="80px"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="line-clamp-2 font-medium">
                      {code.product.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {code.product.shop.name}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-lg font-semibold text-primary">
                    <TicketPercentIcon className="size-5" /> Giảm{" "}
                    {formatDiscountCodeValue(code)}
                  </p>
                  <Badge variant={code.is_available ? "secondary" : "outline"}>
                    {code.used_at
                      ? "Đã dùng"
                      : code.is_available
                        ? "Có thể sử dụng"
                        : discountCodeCanBeSaved(code)
                          ? "Chưa lưu"
                          : "Không còn hiệu lực"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                  <code className="min-w-0 text-base font-semibold break-all">
                    {code.code}
                  </code>
                  <Button
                    aria-label={`Sao chép mã ${code.code}`}
                    variant="ghost"
                    size="icon-sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(code.code)
                        toast.success("Đã sao chép mã giảm giá.")
                      } catch {
                        toast.error(
                          "Không sao chép được. Bạn có thể chọn và sao chép mã trực tiếp."
                        )
                      }
                    }}
                  >
                    <CopyIcon />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Hạn dùng: {formatDate(code.expires_at)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cộng dồn với mã của cùng sản phẩm, tối đa bằng tiền hàng.
                </p>
              </CardContent>
              <CardFooter className="gap-2 border-t p-4 sm:px-5">
                {code.is_available ? (
                  <Button
                    nativeButton={false}
                    render={<Link href={discountCodeProductHref(code)} />}
                  >
                    Dùng ngay
                  </Button>
                ) : discountCodeCanBeSaved(code) ? (
                  <Button
                    disabled={pending}
                    onClick={() => saveCode(code, true)}
                  >
                    Dùng ngay
                  </Button>
                ) : (
                  <Button disabled>Không thể sử dụng</Button>
                )}
                {discountCodeCanBeSaved(code) ? (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => saveCode(code)}
                  >
                    Lưu dùng sau
                  </Button>
                ) : code.saved_at ? (
                  <span className="text-xs text-muted-foreground">
                    Đã lưu vào tài khoản
                  </span>
                ) : null}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
