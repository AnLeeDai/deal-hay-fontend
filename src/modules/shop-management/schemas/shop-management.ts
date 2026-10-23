import { z } from "zod"

import {
  imageFileSchema,
  preparedImageFileSchema,
  PRODUCT_PREPARED_IMAGE_MAX_BYTES,
  PRODUCT_IMAGES_UPLOAD_MAX_BYTES,
  requiredText,
} from "@/lib/validation"
import {
  validateProductOptions,
  variantsMatchOptions,
  type ProductOptionDraft,
  type ProductVariantDraft,
} from "@/modules/shop-management/lib/product-variants"

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

const productStockSchema = z
  .number({ error: "Tồn kho phải là số nguyên." })
  .int("Tồn kho phải là số nguyên.")
  .min(0, "Tồn kho không được âm.")
  .max(999999, "Tồn kho quá lớn.")
const productOptionsSchema = z.array(
  z.object({ name: z.string(), values: z.string() })
)
const productVariantsSchema = z
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
  .max(100, "Mỗi sản phẩm có tối đa 100 biến thể.")
const productFields = {
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
  label: optionalLabelSchema,
  old_price: optionalVariantPriceSchema.optional(),
  video_url: z
    .union([z.url({ protocol: /^https$/ }), z.literal("")])
    .optional(),
  description: optionalDescriptionSchema,
  image: imageFileSchema("Vui lòng tải ảnh đại diện sản phẩm."),
  gallery_images: z
    .array(imageFileSchema("Ảnh bổ sung không hợp lệ."))
    .max(50, "Mỗi sản phẩm được tải tối đa 50 ảnh bổ sung."),
}

const createProductBaseSchema = z.discriminatedUnion("has_variants", [
  z.object({
    ...productFields,
    has_variants: z.literal(false),
    stock: productStockSchema,
    options: z
      .custom<ProductOptionDraft[]>()
      .transform(() => [] as ProductOptionDraft[]),
    variants: z
      .custom<ProductVariantDraft[]>()
      .transform(() => [] as ProductVariantDraft[]),
  }),
  z.object({
    ...productFields,
    has_variants: z.literal(true),
    // The simple-product stock input is hidden in variant mode.
    stock: z.custom<number>().transform(() => 0),
    options: productOptionsSchema,
    variants: productVariantsSchema,
  }),
])

function validateProductCatalog(
  value: Omit<
    z.infer<typeof createProductBaseSchema>,
    "image" | "gallery_images"
  >,
  context: z.RefinementCtx
) {
  if (typeof value.old_price === "number" && value.old_price <= value.price)
    context.addIssue({
      code: "custom",
      path: ["old_price"],
      message: "Giá gốc phải lớn hơn giá ưu đãi.",
    })
  if (!value.has_variants) return

  const catalog = validateProductOptions(value.options)
  if (!catalog.success) {
    catalog.issues.forEach((issue) =>
      context.addIssue({ code: "custom", ...issue })
    )
  }

  if (value.variants.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["variants"],
      message: "Hãy tạo danh sách biến thể từ các thuộc tính đã nhập.",
    })
  } else if (
    catalog.success &&
    !variantsMatchOptions(
      catalog.options,
      catalog.combinationCount,
      value.variants
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["variants"],
      message: "Thuộc tính đã thay đổi. Hãy tạo / cập nhật danh sách biến thể.",
    })
  }

  let defaultCount = 0
  value.variants.forEach((variant, variantIndex) => {
    if (!variant.is_default) return
    defaultCount += 1
    if (!variant.is_active) {
      context.addIssue({
        code: "custom",
        path: ["variants", variantIndex, "is_active"],
        message: "Biến thể mặc định phải đang được bán.",
      })
    }
  })

  if (value.variants.length > 0 && defaultCount !== 1) {
    context.addIssue({
      code: "custom",
      path: ["variants"],
      message: "Sản phẩm phải có đúng một biến thể mặc định đang bán.",
    })
  }
}

export const createProductSchema = createProductBaseSchema.superRefine(
  validateProductCatalog
)

const stagedImageFields = {
  primary_image_upload: z
    .string()
    .min(1, "Vui lòng tải ảnh đại diện sản phẩm.")
    .max(2048),
  gallery_image_uploads: z.array(z.string().min(1).max(2048)).max(50),
}

export const createProductStagedUploadSchema = z
  .discriminatedUnion("has_variants", [
    createProductBaseSchema.options[0]
      .omit({ image: true, gallery_images: true })
      .extend(stagedImageFields),
    createProductBaseSchema.options[1]
      .omit({ image: true, gallery_images: true })
      .extend(stagedImageFields),
  ])
  .superRefine(validateProductCatalog)

// Enforce transport size after browser preparation, so camera batches are not
// rejected solely because their original files add up to more than 32 MB.
export const createProductUploadSchema = createProductSchema.superRefine(
  (value, context) => {
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
      return
    }
    const prepared = preparedImageFileSchema(
      "Ảnh sản phẩm không hợp lệ.",
      PRODUCT_PREPARED_IMAGE_MAX_BYTES
    )
    for (const [index, file] of [
      value.image,
      ...value.gallery_images,
    ].entries()) {
      const result = prepared.safeParse(file)
      if (!result.success)
        result.error.issues.forEach((issue) =>
          context.addIssue({
            code: "custom",
            path: index === 0 ? ["image"] : ["gallery_images", index - 1],
            message: issue.message,
          })
        )
    }
  }
)

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
