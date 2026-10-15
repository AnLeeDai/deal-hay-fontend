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
      label: "Giá bán sản phẩm",
      type: "number",
      value: product.price,
      min: 1000,
      max: 999999999,
      required: true,
    },
    {
      name: "old_price",
      label: "Giá gốc (tùy chọn)",
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
        Giá và ưu đãi
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Giá và ưu đãi sản phẩm</DialogTitle>
          <DialogDescription>
            {product.name}. Shop thiết lập giá sản phẩm. Quảng cáo và giá trị mã
            giảm giá được hệ thống tự động quản lý.
          </DialogDescription>
        </DialogHeader>
        <form
          key={`${product.id}:${product.price}:${product.old_price}:${product.video_url}`}
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
            Giá gốc phải cao hơn giá bán. Mã giảm giá từ quảng cáo được hệ thống
            tính khi khách đặt hàng.
          </p>
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? "Đang lưu..." : "Lưu giá và ưu đãi"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
