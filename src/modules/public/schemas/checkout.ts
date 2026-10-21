import { z } from "zod"

export const checkoutSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên người nhận.")
    .max(120),
  customer_phone: z
    .string()
    .trim()
    .regex(
      /^(\+84|0)[3-9]\d{8}$/,
      "Vui lòng nhập số điện thoại Việt Nam hợp lệ."
    ),
  shipping_address: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập số nhà, tên đường.")
    .max(500),
  shipping_province_code: z.string().min(1, "Vui lòng chọn tỉnh thành."),
  shipping_ward_code: z.string().min(1, "Vui lòng chọn phường xã."),
  quoted_shipping_fee: z.number().int().min(0).max(999999999).optional(),
  shipping_discount_code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Mã miễn phí vận chuyển không hợp lệ.")
    .max(32, "Mã miễn phí vận chuyển không hợp lệ.")
    .optional(),
  quantity: z.number().int().min(1).max(9999),
  note: z.string().max(2000),
})

export type CheckoutValues = z.infer<typeof checkoutSchema>
