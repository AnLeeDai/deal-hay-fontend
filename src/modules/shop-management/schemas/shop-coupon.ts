import { z } from "zod"

export const shopCouponSchema = z
  .object({
    name: z.string().trim().min(1, "Nhập tên hiển thị ưu đãi.").max(120),
    discount_type: z.enum(["fixed", "percent"]),
    discount_value: z.number().int().min(1).max(999999999),
    minimum_order_amount: z.number().int().min(0).max(999999999),
    maximum_discount_amount: z.number().int().min(1).max(999999999).nullable(),
    usage_limit: z.number().int().min(1).max(999999).nullable(),
    starts_at: z.iso.datetime().nullable(),
    ends_at: z.iso.datetime().nullable(),
    is_active: z.boolean(),
    product_ids: z
      .array(z.uuid())
      .min(1, "Chọn ít nhất một sản phẩm.")
      .max(1000),
  })
  .refine(
    (value) => value.discount_type !== "percent" || value.discount_value <= 100,
    {
      path: ["discount_value"],
      message: "Phần trăm giảm phải từ 1 đến 100.",
    }
  )
  .refine(
    (value) =>
      !value.starts_at ||
      !value.ends_at ||
      new Date(value.ends_at) > new Date(value.starts_at),
    {
      path: ["ends_at"],
      message: "Ngày kết thúc phải sau ngày bắt đầu.",
    }
  )

export type ShopCouponValues = z.infer<typeof shopCouponSchema>
