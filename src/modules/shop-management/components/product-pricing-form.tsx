"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateProductPricingAction } from "@/modules/shop-management/actions"
import type { ShopProduct } from "@/types/shop"

export function ProductPricingForm({ product }: { product: ShopProduct }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const fields = [
    {
      name: "price",
      label: "Giá ưu đãi sau quảng cáo / Giá bán",
      type: "number",
      value: product.price,
      min: 1000,
      max: 999999999,
      required: true,
    },
    {
      name: "old_price",
      label: "Giá gốc (để trống nếu không giảm giá)",
      type: "number",
      value: product.old_price ?? "",
      min: 1000,
      max: 999999999,
    },
    {
      name: "video_url",
      label: "URL video sản phẩm (HTTPS)",
      type: "url",
      value: product.video_url ?? "",
    },
    {
      name: "advertisement_video_url",
      label: "URL video quảng cáo nhận ưu đãi (HTTPS)",
      type: "url",
      value: product.advertisement_video_url ?? "",
    },
    {
      name: "advertisement_duration_seconds",
      label: "Thời lượng đầy đủ của quảng cáo (giây)",
      type: "number",
      value: product.advertisement_duration_seconds ?? "",
      min: 5,
      max: 300,
    },
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value)
          setErrors({})
        }
      }}
    >
      <DialogTrigger
        render={<Button className="w-full" size="sm" variant="outline" />}
      >
        Giá và quảng cáo
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Giá và quảng cáo sản phẩm</DialogTitle>
          <DialogDescription>
            {product.name}. Khách đặt ngay trả giá gốc; xem hết quảng cáo để mở
            giá ưu đãi. Biến thể áp dụng cùng tỷ lệ giảm giá.
          </DialogDescription>
        </DialogHeader>
        <form
          key={`${product.id}:${product.price}:${product.old_price}:${product.advertisement_video_url}`}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            startTransition(async () => {
              const state = await updateProductPricingAction(product.id, data)
              if (!state.success) {
                setErrors(state.errors ?? {})
                toast.error(state.message)
                return
              }
              toast.success(state.message)
              setOpen(false)
            })
          }}
        >
          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={`${product.id}-${field.name}`}>
                {field.label}
              </Label>
              <Input
                id={`${product.id}-${field.name}`}
                name={field.name}
                type={field.type}
                defaultValue={field.value}
                min={field.min}
                max={field.max}
                required={field.required}
                aria-invalid={Boolean(errors[field.name])}
              />
              {errors[field.name]?.map((error) => (
                <p className="text-sm text-destructive" key={error}>
                  {error}
                </p>
              ))}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Dùng đường dẫn video trực tiếp. Thời lượng phải khớp với video để
            xác nhận ưu đãi sau khi xem hết.
          </p>
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? "Đang lưu..." : "Lưu giá và quảng cáo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
