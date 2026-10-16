"use server"

import { revalidatePath } from "next/cache"

import { ApiError, apiFetch } from "@/api/client"
import type { ActionState } from "@/types/forms"
import type {
  RewardedTaskConfig,
  RewardedTaskSession,
} from "@/types/rewarded-task"

type RewardedTaskActionState<T> = ActionState & {
  data?: T
  requires_sign_in?: boolean
  reset_task?: boolean
}

function rewardedTaskPath(shopCode: string, productSlug: string): string {
  return `/shops/${encodeURIComponent(shopCode)}/products/${encodeURIComponent(productSlug)}/rewarded-tasks`
}

function hasSafeOfferwallUrl(task: RewardedTaskSession): boolean {
  const url = new URL(task.offerwall_url)
  return (
    url.protocol === "https:" &&
    url.hostname === "api.adgem.com" &&
    (url.port === "" || url.port === "443") &&
    url.pathname === "/v1/wall" &&
    !url.username &&
    !url.password
  )
}

function normalizeRewardedTaskError(error: unknown): ActionState & {
  requires_sign_in?: boolean
  reset_task?: boolean
} {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        success: false,
        message: "Vui lòng đăng nhập để làm nhiệm vụ và lưu mã giảm giá.",
        requires_sign_in: true,
        reset_task: true,
      }
    }
    if (error.status === 429) {
      return {
        success: false,
        message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
      }
    }
    if (error.status === 403 || error.status === 404) {
      return {
        success: false,
        message:
          "Không tìm thấy nhiệm vụ phù hợp với tài khoản và sản phẩm này.",
        reset_task: true,
      }
    }
    if (error.status === 503) {
      return {
        success: false,
        message:
          "Nhiệm vụ nhận mã đang được chuẩn bị. Bạn vẫn có thể đặt hàng.",
      }
    }
  }

  return {
    success: false,
    message: "Chưa kết nối được với nhiệm vụ. Vui lòng thử lại sau.",
  }
}

export async function loadRewardedTaskConfigAction(
  shopCode: string,
  productSlug: string
): Promise<RewardedTaskActionState<RewardedTaskConfig>> {
  try {
    const response = await apiFetch<RewardedTaskConfig>({
      path: rewardedTaskPath(shopCode, productSlug),
      cache: "no-store",
    })
    return { success: true, message: "", data: response }
  } catch (error) {
    return normalizeRewardedTaskError(error)
  }
}

export async function startRewardedTaskAction(
  shopCode: string,
  productSlug: string
): Promise<RewardedTaskActionState<RewardedTaskSession>> {
  try {
    const response = await apiFetch<{ task: RewardedTaskSession }>({
      method: "POST",
      path: rewardedTaskPath(shopCode, productSlug),
      cache: "no-store",
    })
    if (!hasSafeOfferwallUrl(response.task)) {
      return { success: false, message: "Chưa mở được trang nhiệm vụ an toàn." }
    }
    return {
      success: true,
      message: "Nhiệm vụ đã sẵn sàng. Mở trang nhiệm vụ để tiếp tục.",
      data: response.task,
    }
  } catch (error) {
    return normalizeRewardedTaskError(error)
  }
}

export async function checkRewardedTaskAction(
  shopCode: string,
  productSlug: string,
  taskId: string
): Promise<RewardedTaskActionState<RewardedTaskSession>> {
  try {
    const response = await apiFetch<{ task: RewardedTaskSession }>({
      path: `${rewardedTaskPath(shopCode, productSlug)}/${encodeURIComponent(taskId)}`,
      cache: "no-store",
    })
    if (!hasSafeOfferwallUrl(response.task)) {
      return { success: false, message: "Chưa mở được trang nhiệm vụ an toàn." }
    }
    if (response.task.discount_codes.length > 0) {
      revalidatePath("/discount-codes")
    }
    return {
      success: true,
      message: response.task.discount_codes.length
        ? "Đã nhận mã giảm giá do nhà cung cấp xác nhận."
        : "Chưa có nhiệm vụ mới được nhà cung cấp xác nhận. Bạn có thể kiểm tra lại sau.",
      data: response.task,
    }
  } catch (error) {
    return normalizeRewardedTaskError(error)
  }
}
