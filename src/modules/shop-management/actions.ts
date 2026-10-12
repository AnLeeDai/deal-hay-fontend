"use server"

import { revalidatePath } from "next/cache"

import { ApiError } from "@/api/client"
import { replyToReview } from "@/api/catalog/mutations"
import {
  createCoupon,
  createProduct,
  deleteCoupon,
  deleteProduct,
  adjustInventory,
  reorderCategories,
  updateOrderStatus,
  updateProductStatus,
} from "@/api/profile/mutations"
import type { ActionState } from "@/types/forms"
import {
  adjustInventorySchema,
  createCouponSchema,
  createProductSchema,
  replyReviewSchema,
  type AdjustInventoryValues,
  type CreateCouponValues,
  type ReplyReviewValues,
} from "@/modules/shop-management/schemas/shop-management"

function toState(error: unknown, fallback: string): ActionState {
  if (error instanceof ApiError) {
    return { success: false, message: error.message, errors: error.errors }
  }
  return { success: false, message: fallback }
}

export async function createProductAction(
  formData: FormData
): Promise<ActionState> {
  let catalog: Record<string, unknown> = {}

  try {
    const rawCatalog = formData.get("catalog")
    catalog = rawCatalog ? JSON.parse(String(rawCatalog)) : {}
  } catch {
    return {
      success: false,
      message: "Thông tin thuộc tính và biến thể sản phẩm không hợp lệ.",
    }
  }

  const parsed = createProductSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    price: Number(formData.get("price")),
    stock: Number(formData.get("stock")),
    description: formData.get("description"),
    label: formData.get("label"),
    image: formData.get("image"),
    gallery_images: formData.getAll("gallery_images"),
    has_variants: catalog.has_variants === true,
    options: Array.isArray(catalog.options) ? catalog.options : [],
    variants: Array.isArray(catalog.variants) ? catalog.variants : [],
  })

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại thông tin sản phẩm.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const payload = new FormData()
  payload.set("name", parsed.data.name)
  payload.set("category", parsed.data.category)
  payload.set("price", String(parsed.data.price))
  payload.set("stock", String(parsed.data.has_variants ? 0 : parsed.data.stock))
  if (parsed.data.description && parsed.data.description !== "") {
    payload.set("description", parsed.data.description)
  }
  if (parsed.data.label && parsed.data.label !== "") {
    payload.set("label", parsed.data.label)
  }
  payload.set("image", parsed.data.image)
  parsed.data.gallery_images.forEach((image) => {
    payload.append("gallery_images[]", image)
  })

  if (parsed.data.has_variants) {
    parsed.data.options.forEach((option, optionIndex) => {
      const values = option.values
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)

      payload.set(`options[${optionIndex}][name]`, option.name.trim())
      values.forEach((value, valueIndex) => {
        payload.set(`options[${optionIndex}][values][${valueIndex}]`, value)
      })
    })

    parsed.data.variants.forEach((variant, variantIndex) => {
      Object.entries(variant.option_values).forEach(([name, value]) => {
        payload.set(`variants[${variantIndex}][option_values][${name}]`, value)
      })
      if (variant.price !== "") {
        payload.set(`variants[${variantIndex}][price]`, String(variant.price))
      }
      payload.set(`variants[${variantIndex}][stock]`, String(variant.stock))
      payload.set(
        `variants[${variantIndex}][is_active]`,
        variant.is_active ? "1" : "0"
      )
      payload.set(
        `variants[${variantIndex}][is_default]`,
        variant.is_default ? "1" : "0"
      )
    })
  }

  try {
    const response = await createProduct(payload)
    revalidatePath("/shop-manage")
    revalidatePath("/sell")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể tạo sản phẩm.")
  }
}

export async function toggleProductStatusAction(
  productId: string,
  isActive: boolean
): Promise<ActionState> {
  try {
    const response = await updateProductStatus(productId, isActive)
    revalidatePath("/shop-manage")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể cập nhật trạng thái sản phẩm.")
  }
}

export async function deleteProductAction(
  productId: string
): Promise<ActionState> {
  try {
    const response = await deleteProduct(productId)
    revalidatePath("/shop-manage")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể xoá sản phẩm.")
  }
}

export async function adjustInventoryAction(
  productId: string,
  values: AdjustInventoryValues
): Promise<ActionState> {
  const parsed = adjustInventorySchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Dữ liệu điều chỉnh tồn kho chưa hợp lệ.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const response = await adjustInventory(productId, {
      ...parsed.data,
      shop_product_variant_id: parsed.data.shop_product_variant_id || undefined,
    })
    revalidatePath("/shop-manage")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể điều chỉnh tồn kho.")
  }
}

export async function createCouponAction(
  values: CreateCouponValues
): Promise<ActionState> {
  const parsed = createCouponSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Dữ liệu coupon chưa hợp lệ.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const response = await createCoupon({
      ...parsed.data,
      usage_limit:
        parsed.data.usage_limit === "" ? undefined : parsed.data.usage_limit,
      maximum_discount_amount:
        parsed.data.maximum_discount_amount === ""
          ? undefined
          : parsed.data.maximum_discount_amount,
      starts_at: parsed.data.starts_at || undefined,
      ends_at: parsed.data.ends_at || undefined,
    })
    revalidatePath("/shop-manage")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể tạo coupon.")
  }
}

export async function deleteCouponAction(
  couponId: string
): Promise<ActionState> {
  try {
    const response = await deleteCoupon(couponId)
    revalidatePath("/shop-manage")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể xoá coupon.")
  }
}

export async function updateOrderStatusAction(
  orderId: string,
  status: string
): Promise<ActionState> {
  try {
    const response = await updateOrderStatus(orderId, status)
    revalidatePath("/shop-manage")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể cập nhật trạng thái đơn hàng.")
  }
}

export async function reorderCategoriesAction(
  categoryIds: string[]
): Promise<ActionState> {
  try {
    const response = await reorderCategories(categoryIds)
    revalidatePath("/shop-manage")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể sắp xếp danh mục.")
  }
}

export async function replyReviewAction(
  reviewId: string,
  values: ReplyReviewValues
): Promise<ActionState> {
  const parsed = replyReviewSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng nhập phản hồi cho đánh giá.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const response = await replyToReview(reviewId, parsed.data.reply)
    revalidatePath("/shop-manage")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể phản hồi đánh giá.")
  }
}
