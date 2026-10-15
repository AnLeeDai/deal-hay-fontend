"use server"

import { revalidatePath } from "next/cache"

import { ApiError } from "@/api/client"
import {
  createCategory,
  deleteCategory,
  deleteShopProduct,
  reviewTicket,
  startAdminChat,
  toggleUserLock,
  updateCategory,
} from "@/api/admin/mutations"
import { requireAdmin } from "@/lib/auth"
import type { ActionState } from "@/types/forms"
import {
  categorySchema,
  deleteShopProductSchema,
  reviewTicketSchema,
  type CategoryValues,
  type DeleteShopProductValues,
  type ReviewTicketValues,
} from "@/modules/admin/schemas/admin"

function toState(error: unknown, fallback: string): ActionState {
  if (error instanceof ApiError) {
    return { success: false, message: error.message, errors: error.errors }
  }
  return { success: false, message: fallback }
}

export async function createCategoryAction(
  values: CategoryValues
): Promise<ActionState> {
  const parsed = categorySchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng nhập tên danh mục.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }
  try {
    const response = await createCategory(parsed.data)
    revalidatePath("/admin/categories")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể tạo danh mục.")
  }
}

export async function updateCategoryAction(
  categoryId: string,
  values: CategoryValues
): Promise<ActionState> {
  const parsed = categorySchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng nhập tên danh mục.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }
  try {
    const response = await updateCategory(categoryId, parsed.data)
    revalidatePath("/admin/categories")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể cập nhật danh mục.")
  }
}

export async function deleteCategoryAction(categoryId: string): Promise<void> {
  await deleteCategory(categoryId)
  revalidatePath("/admin/categories")
}

export async function toggleUserLockAction(
  userId: string,
  action: "lock" | "unlock",
  lockReason?: string
): Promise<void> {
  await toggleUserLock(userId, { action, lock_reason: lockReason ?? null })
  revalidatePath("/", "layout")
}

export async function startAdminChatAction(
  userId: string
): Promise<ActionState & { conversationSlug?: string }> {
  await requireAdmin()
  try {
    const response = await startAdminChat(userId)
    revalidatePath("/chats")
    return {
      success: true,
      message: "Đã mở cuộc trò chuyện.",
      conversationSlug: response.conversation.slug,
    }
  } catch (error) {
    return toState(error, "Không thể mở cuộc trò chuyện với người dùng này.")
  }
}

export async function reviewTicketAction(
  ticketId: string,
  values: ReviewTicketValues
): Promise<ActionState> {
  const parsed = reviewTicketSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      message: "Dữ liệu ticket chưa hợp lệ.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }
  try {
    const response = await reviewTicket(ticketId, {
      ...parsed.data,
      admin_note: parsed.data.admin_note || undefined,
    })
    revalidatePath("/admin/tickets")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể cập nhật ticket.")
  }
}

export async function deleteShopProductAction(
  shopId: string,
  productId: string,
  values: DeleteShopProductValues
): Promise<ActionState> {
  const parsed = deleteShopProductSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng nhập lý do xoá sản phẩm.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }
  try {
    const response = await deleteShopProduct(
      shopId,
      productId,
      parsed.data.reason
    )
    revalidatePath("/admin/shops")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể xoá sản phẩm của shop.")
  }
}
