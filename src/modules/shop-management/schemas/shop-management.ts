import { z } from "zod"

import {
  imageFileSchema,
  PRODUCT_IMAGES_UPLOAD_MAX_BYTES,
  requiredText,
} from "@/lib/validation"

const optionalLabelSchema = z.union([
  z.string().trim().max(80, "Nhãn sản phẩm không được vượt quá 80 ký tự."),
  z.literal(""),
])
const optionalDescriptionSchema = z.union([z.string().trim(), z.literal("")])
const optionalVariantPriceSchema = z.union([
  z
    .number({ error: "Giá biến thể phải là số nguyên." })
    .int("Giá biến thể phải là số nguyên.")
    .min(1000, "Giá biến thể tối thiểu là 1.000đ.")
    .max(999999999, "Giá biến thể quá lớn."),
  z.literal(""),
])
const optionalVariantSchema = z.union([
  z.string().trim().uuid("Biến thể sản phẩm không hợp lệ."),
  z.literal(""),
])
const optionalDateTimeSchema = (message: string) =>
  z.union([z.iso.datetime({ local: true, message }), z.literal("")])
const optionalPositiveIntSchema = (
  invalid: string,
  min: string,
  max: string,
  limit: number
) =>
  z.union([
    z.number({ error: invalid }).int(invalid).min(1, min).max(limit, max),
    z.literal(""),
    z.undefined(),
  ])

export const createProductSchema = z
  .object({
    name: requiredText("Vui lòng nhập tên sản phẩm.").max(
      255,
      "Tên sản phẩm không được vượt quá 255 ký tự."
    ),
    category: requiredText("Vui lòng chọn danh mục.").max(
      120,
      "Danh mục không được vượt quá 120 ký tự."
    ),
    price: z
      .number({ error: "Giá bán phải là số nguyên." })
      .int("Giá bán phải là số nguyên.")
      .min(1000, "Giá bán tối thiểu là 1.000đ.")
      .max(999999999, "Giá bán quá lớn."),
    stock: z
      .number({ error: "Tồn kho phải là số nguyên." })
      .int("Tồn kho phải là số nguyên.")
      .min(0, "Tồn kho không được âm.")
      .max(999999, "Tồn kho quá lớn."),
    label: optionalLabelSchema,
    description: optionalDescriptionSchema,
    image: imageFileSchema("Vui lòng tải ảnh đại diện sản phẩm."),
    gallery_images: z
      .array(imageFileSchema("Ảnh bổ sung không hợp lệ."))
      .max(50, "Mỗi sản phẩm được tải tối đa 50 ảnh bổ sung."),
    has_variants: z.boolean(),
    options: z
      .array(
        z.object({
          name: requiredText("Vui lòng nhập tên thuộc tính.").max(
            80,
            "Tên thuộc tính không được vượt quá 80 ký tự."
          ),
          values: requiredText("Vui lòng nhập ít nhất một giá trị thuộc tính."),
        })
      )
      .max(3, "Mỗi sản phẩm có tối đa 3 thuộc tính."),
    variants: z
      .array(
        z.object({
          option_values: z.record(z.string(), z.string()),
          price: optionalVariantPriceSchema,
          stock: z
            .number({ error: "Tồn kho biến thể phải là số nguyên." })
            .int("Tồn kho biến thể phải là số nguyên.")
            .min(0, "Tồn kho biến thể không được âm.")
            .max(999999, "Tồn kho biến thể quá lớn."),
          is_active: z.boolean(),
          is_default: z.boolean(),
        })
      )
      .max(100, "Mỗi sản phẩm có tối đa 100 biến thể."),
  })
  .superRefine((value, context) => {
    const totalImageBytes = [value.image, ...value.gallery_images].reduce(
      (total, file) => total + file.size,
      0
    )
    if (totalImageBytes > PRODUCT_IMAGES_UPLOAD_MAX_BYTES) {
      context.addIssue({
        code: "custom",
        path: ["gallery_images"],
        message: "Tổng dung lượng ảnh sản phẩm không được vượt quá 32 MB.",
      })
    }

    if (!value.has_variants) {
      return
    }

    if (value.options.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Vui lòng thêm ít nhất một thuộc tính sản phẩm.",
      })
    }

    if (value.variants.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variants"],
        message: "Hãy tạo danh sách biến thể từ các thuộc tính đã nhập.",
      })
    }

    const optionNames = new Set<string>()
    const allowedValues = new Map<string, Set<string>>()

    value.options.forEach((option, optionIndex) => {
      const normalizedName = option.name.trim().toLocaleLowerCase("vi")
      const values = option.values
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      const normalizedValues = values.map((item) =>
        item.toLocaleLowerCase("vi")
      )

      if (optionNames.has(normalizedName)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options", optionIndex, "name"],
          message: "Tên thuộc tính không được trùng nhau.",
        })
      }
      optionNames.add(normalizedName)

      if (values.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options", optionIndex, "values"],
          message: "Vui lòng nhập ít nhất một giá trị thuộc tính.",
        })
      }

      if (new Set(normalizedValues).size !== normalizedValues.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options", optionIndex, "values"],
          message: "Giá trị thuộc tính không được trùng nhau.",
        })
      }

      allowedValues.set(normalizedName, new Set(normalizedValues))
    })

    const combinations = new Set<string>()
    let defaultCount = 0

    value.variants.forEach((variant, variantIndex) => {
      const entries = Object.entries(variant.option_values)
      const combination = value.options.map((option) => {
        const entry = entries.find(
          ([name]) =>
            name.trim().toLocaleLowerCase("vi") ===
            option.name.trim().toLocaleLowerCase("vi")
        )
        const normalizedValue = entry?.[1].trim().toLocaleLowerCase("vi")
        const normalizedName = option.name.trim().toLocaleLowerCase("vi")

        if (
          !normalizedValue ||
          !allowedValues.get(normalizedName)?.has(normalizedValue)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["variants", variantIndex, "option_values"],
            message: `Giá trị của thuộc tính ${option.name} không hợp lệ.`,
          })
        }

        return `${normalizedName}=${normalizedValue ?? ""}`
      })

      if (entries.length !== value.options.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", variantIndex, "option_values"],
          message: "Biến thể chưa khớp với danh sách thuộc tính.",
        })
      }

      const key = combination.join("|")
      if (combinations.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", variantIndex, "option_values"],
          message: "Tổ hợp biến thể không được trùng nhau.",
        })
      }
      combinations.add(key)

      if (variant.is_default) {
        defaultCount += 1
        if (!variant.is_active) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["variants", variantIndex, "is_active"],
            message: "Biến thể mặc định phải đang được bán.",
          })
        }
      }
    })

    if (value.variants.length > 0 && defaultCount !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variants"],
        message: "Sản phẩm phải có đúng một biến thể mặc định đang bán.",
      })
    }
  })

export const adjustInventorySchema = z.object({
  quantity_delta: z
    .number({ error: "Số lượng điều chỉnh phải là số nguyên." })
    .int("Số lượng điều chỉnh phải là số nguyên.")
    .min(-999999, "Số lượng điều chỉnh quá nhỏ.")
    .max(999999, "Số lượng điều chỉnh quá lớn.")
    .refine((value) => value !== 0, "Số lượng điều chỉnh không được bằng 0."),
  note: requiredText("Vui lòng nhập ghi chú điều chỉnh.").max(
    255,
    "Ghi chú điều chỉnh không được vượt quá 255 ký tự."
  ),
  shop_product_variant_id: optionalVariantSchema,
})

export const createCouponSchema = z
  .object({
    code: requiredText("Vui lòng nhập mã coupon.").max(
      40,
      "Mã coupon không được vượt quá 40 ký tự."
    ),
    name: requiredText("Vui lòng nhập tên hiển thị.").max(
      120,
      "Tên hiển thị không được vượt quá 120 ký tự."
    ),
    discount_type: z.enum(["fixed", "percent"], {
      message: "Loại giảm giá không hợp lệ.",
    }),
    discount_value: z
      .number({ error: "Giá trị giảm phải là số nguyên." })
      .int("Giá trị giảm phải là số nguyên.")
      .min(1, "Giá trị giảm tối thiểu là 1.")
      .max(999999999, "Giá trị giảm quá lớn."),
    minimum_order_amount: z
      .number({ error: "Đơn tối thiểu phải là số nguyên." })
      .int("Đơn tối thiểu phải là số nguyên.")
      .min(0, "Đơn tối thiểu không được âm.")
      .max(999999999, "Đơn tối thiểu quá lớn."),
    usage_limit: optionalPositiveIntSchema(
      "Giới hạn sử dụng phải là số nguyên.",
      "Giới hạn sử dụng tối thiểu là 1.",
      "Giới hạn sử dụng quá lớn.",
      999999
    ),
    maximum_discount_amount: optionalPositiveIntSchema(
      "Giảm tối đa phải là số nguyên.",
      "Giảm tối đa tối thiểu là 1.",
      "Giảm tối đa quá lớn.",
      999999999
    ),
    starts_at: optionalDateTimeSchema("Thời gian bắt đầu không hợp lệ."),
    ends_at: optionalDateTimeSchema("Thời gian kết thúc không hợp lệ."),
    is_active: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.discount_type === "percent" && value.discount_value > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discount_value"],
        message: "Giá trị giảm phần trăm không được vượt quá 100.",
      })
    }

    if (
      value.starts_at &&
      value.ends_at &&
      new Date(value.ends_at) <= new Date(value.starts_at)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ends_at"],
        message: "Thời gian kết thúc phải sau thời gian bắt đầu.",
      })
    }
  })

export const replyReviewSchema = z.object({
  reply: requiredText("Vui lòng nhập nội dung phản hồi.")
    .min(2, "Nội dung phản hồi phải có ít nhất 2 ký tự.")
    .max(2000, "Nội dung phản hồi không được vượt quá 2.000 ký tự."),
})

export type CreateProductValues = z.infer<typeof createProductSchema>
export type AdjustInventoryValues = z.infer<typeof adjustInventorySchema>
export type CreateCouponValues = z.infer<typeof createCouponSchema>
export type ReplyReviewValues = z.infer<typeof replyReviewSchema>
