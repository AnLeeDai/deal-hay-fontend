"use server"

import { revalidatePath } from "next/cache"

import { ApiError } from "@/api/client"
import { apiFetch } from "@/api/client"
import {
  deleteReview,
  followShop,
  reactToShop,
  startChat,
  unfollowShop,
  upsertReview,
} from "@/api/catalog/mutations"
import type { ActionState } from "@/types/forms"
import { reviewProductSchema } from "@/modules/public/schemas/reviews"
import {
  checkoutSchema,
  type CheckoutValues,
} from "@/modules/public/schemas/checkout"

type OrderPayload = CheckoutValues & {
  variant_id?: string
  advertisement_view_id?: string
}

export async function orderProductAction(
  shopUserCode: string,
  productSlug: string,
  values: OrderPayload,
  idempotencyKey: string
): Promise<ActionState & { data?: { order_number: string; total: number } }> {
  const parsed = checkoutSchema.safeParse(values)
  if (!parsed.success)
    return {
      success: false,
      message: "Vui lòng kiểm tra thông tin giao hàng.",
      errors: parsed.error.flatten().fieldErrors,
    }
  try {
    const response = await apiFetch<{
      message: string
      order: { order_number: string; total: number }
    }>({
      method: "POST",
      path: `/shops/${encodeURIComponent(shopUserCode)}/products/${encodeURIComponent(productSlug)}/orders`,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {
        ...parsed.data,
        variant_id: values.variant_id,
        advertisement_view_id: values.advertisement_view_id,
      },
    })
    revalidatePath(`/shops/${shopUserCode}/products/${productSlug}`)
    return { success: true, message: response.message, data: response.order }
  } catch (error) {
    return normalizeError(error)
  }
}

export async function startProductAdvertisementAction(
  shopUserCode: string,
  productSlug: string
): Promise<
  ActionState & {
    data?: { id: string; video_url: string; duration_seconds: number }
  }
> {
  try {
    const data = await apiFetch<{
      id: string
      video_url: string
      duration_seconds: number
    }>({
      method: "POST",
      path: `/shops/${encodeURIComponent(shopUserCode)}/products/${encodeURIComponent(productSlug)}/advertisement`,
    })
    return { success: true, message: "Xem hết video để nhận ưu đãi.", data }
  } catch (error) {
    return normalizeError(error)
  }
}

export async function completeProductAdvertisementAction(
  shopUserCode: string,
  productSlug: string,
  viewId: string
): Promise<ActionState> {
  try {
    const data = await apiFetch<{ message: string }>({
      method: "POST",
      path: `/shops/${encodeURIComponent(shopUserCode)}/products/${encodeURIComponent(productSlug)}/advertisement/${encodeURIComponent(viewId)}/complete`,
    })
    return { success: true, message: data.message }
  } catch (error) {
    return normalizeError(error)
  }
}

function normalizeError(error: unknown): ActionState {
  if (error instanceof ApiError) {
    return { success: false, message: error.message, errors: error.errors }
  }
  return { success: false, message: "Không thể xử lý yêu cầu." }
}

export async function toggleFollowAction(
  shopUserCode: string,
  isFollowing: boolean
): Promise<void> {
  if (isFollowing) {
    await unfollowShop(shopUserCode)
  } else {
    await followShop(shopUserCode)
  }
  revalidatePath(`/shops/${shopUserCode}`)
}

export async function reactShopAction(
  shopUserCode: string,
  reaction: "like" | "dislike"
): Promise<void> {
  await reactToShop(shopUserCode, reaction)
  revalidatePath(`/shops/${shopUserCode}`)
}

export async function startChatAction(
  shopUserCode: string,
  productId?: string,
  variantId?: string
): Promise<ActionState & { data?: { conversationSlug: string } }> {
  try {
    const response = await startChat(shopUserCode, {
      client_message_id: crypto.randomUUID(),
      product: productId,
      variant: variantId,
    })

    return {
      success: true,
      message: "Đã mở cuộc trò chuyện với cửa hàng.",
      data: { conversationSlug: response.conversation.slug },
    }
  } catch (error) {
    return normalizeError(error)
  }
}

export async function reviewProductAction(
  shopUserCode: string,
  productSlug: string,
  formData: FormData
): Promise<ActionState> {
  const parsed = reviewProductSchema.safeParse({
    reaction: formData.get("reaction"),
    content: formData.get("content"),
    image:
      formData.get("image") instanceof File &&
      (formData.get("image") as File).size > 0
        ? formData.get("image")
        : undefined,
  })

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại nội dung đánh giá.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const payload = new FormData()
    payload.set("reaction", parsed.data.reaction)
    payload.set("content", parsed.data.content)
    if (parsed.data.image instanceof File) {
      payload.set("image", parsed.data.image)
    }
    const response = await upsertReview(shopUserCode, productSlug, payload)
    revalidatePath(`/shops/${shopUserCode}/products/${productSlug}`)
    return { success: true, message: response.message }
  } catch (error) {
    return normalizeError(error)
  }
}

export async function deleteReviewAction(
  shopUserCode: string,
  productSlug: string
): Promise<void> {
  await deleteReview(shopUserCode, productSlug)
  revalidatePath(`/shops/${shopUserCode}/products/${productSlug}`)
}
