import { z } from "zod"

const shippingFeeSchema = z
  .number({ error: "Vui lòng nhập phí vận chuyển." })
  .int("Phí vận chuyển phải là số nguyên đồng.")
  .min(0, "Phí vận chuyển không được âm.")
  .max(999999999, "Phí vận chuyển tối đa là 999.999.999 đồng.")

export const shippingSettingsSchema = z
  .object({
    enabled: z.boolean(),
    base_fee: shippingFeeSchema,
    ward_rates: z.array(
      z.object({
        ward_code: z.number().int().positive("Vui lòng chọn phường/xã."),
        fee: shippingFeeSchema,
      })
    ),
  })
  .superRefine((settings, context) => {
    const selectedWards = new Set<number>()
    settings.ward_rates.forEach((rate, index) => {
      if (selectedWards.has(rate.ward_code)) {
        context.addIssue({
          code: "custom",
          path: ["ward_rates", index, "ward_code"],
          message: "Phường/xã này đã có mức phí riêng.",
        })
      }
      selectedWards.add(rate.ward_code)
    })
  })
