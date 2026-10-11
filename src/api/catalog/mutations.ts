import { apiFetch } from "@/api/client"
import { catalogRoutes } from "@/api/catalog/routes"
import type { ApiMessageResponse } from "@/types/common"

export function startChat(
  shopUserCode: string,
  payload: { client_message_id?: string; product?: string; variant?: string }
): Promise<{ conversation: { slug: string }; replayed: boolean }> {
  return apiFetch({
    method: "POST",
    path: catalogRoutes.startChat(shopUserCode),
    body: payload,
  })
}

export function followShop(shopUserCode: string): Promise<ApiMessageResponse> {
  return apiFetch({ method: "POST", path: catalogRoutes.follow(shopUserCode) })
}

export function unfollowShop(
  shopUserCode: string
): Promise<ApiMessageResponse> {
  return apiFetch({
    method: "DELETE",
    path: catalogRoutes.follow(shopUserCode),
  })
}

export function reactToShop(
  shopUserCode: string,
  reaction: "like" | "dislike"
): Promise<ApiMessageResponse> {
  return apiFetch({
    method: "PUT",
    path: catalogRoutes.reaction(shopUserCode),
    body: { reaction },
  })
}

export function clearShopReaction(
  shopUserCode: string
): Promise<ApiMessageResponse> {
  return apiFetch({
    method: "DELETE",
    path: catalogRoutes.reaction(shopUserCode),
  })
}

export function upsertReview(
  shopUserCode: string,
  productSlug: string,
  payload: FormData
): Promise<ApiMessageResponse> {
  return apiFetch({
    method: "PUT",
    path: catalogRoutes.review(shopUserCode, productSlug),
    body: payload,
  })
}

export function deleteReview(
  shopUserCode: string,
  productSlug: string
): Promise<ApiMessageResponse> {
  return apiFetch({
    method: "DELETE",
    path: catalogRoutes.review(shopUserCode, productSlug),
  })
}

export function replyToReview(
  reviewId: string,
  reply: string
): Promise<ApiMessageResponse> {
  return apiFetch({
    method: "PATCH",
    path: catalogRoutes.reviewReply(reviewId),
    body: { reply },
  })
}
