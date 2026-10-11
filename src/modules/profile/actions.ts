"use server"

import { revalidatePath } from "next/cache"

import { ApiError } from "@/api/client"
import {
  updateAvatar,
  updatePassword,
  updateProfile,
  updateShop,
  createShopOwnerUpgrade,
} from "@/api/profile/mutations"
import { profileRoutes } from "@/api/profile/routes"
import type { ActionState } from "@/types/forms"
import {
  avatarSchema,
  shopOwnerUpgradeSchema,
  updatePasswordSchema,
  updateProfileSchema,
  updateShopProfileSchema,
  type ShopOwnerUpgradeValues,
  type UpdatePasswordValues,
  type UpdateProfileValues,
  type UpdateShopProfileValues,
} from "@/modules/profile/schemas/profile"

function toState(error: unknown, fallback: string): ActionState {
  if (error instanceof ApiError) {
    return { success: false, message: error.message, errors: error.errors }
  }
  return { success: false, message: fallback }
}

export async function updateProfileAction(
  values: UpdateProfileValues
): Promise<ActionState> {
  const parsed = updateProfileSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại thông tin cá nhân.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const response = await updateProfile({
      ...parsed.data,
      phone_number: parsed.data.phone_number || undefined,
      province: parsed.data.province || undefined,
      ward: parsed.data.ward || undefined,
      address_detail: parsed.data.address_detail || undefined,
    })
    revalidatePath("/profile")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể cập nhật hồ sơ.")
  }
}

export async function updatePasswordAction(
  values: UpdatePasswordValues
): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại mật khẩu.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const response = await updatePassword(parsed.data)
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể cập nhật mật khẩu.")
  }
}

export async function updateAvatarAction(
  formData: FormData
): Promise<ActionState> {
  const parsed = avatarSchema.safeParse({
    avatar: formData.get("avatar"),
  })

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng chọn ảnh đại diện hợp lệ.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const payload = new FormData()
    payload.set("avatar", parsed.data.avatar)
    const response = await updateAvatar(profileRoutes.avatar, payload)
    revalidatePath("/profile")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể cập nhật ảnh đại diện.")
  }
}

export async function updateShopAvatarAction(
  formData: FormData
): Promise<ActionState> {
  const parsed = avatarSchema.safeParse({
    avatar: formData.get("avatar"),
  })

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng chọn ảnh đại diện shop hợp lệ.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const payload = new FormData()
    payload.set("avatar", parsed.data.avatar)
    const response = await updateAvatar(profileRoutes.shopAvatar, payload)
    revalidatePath("/shop-manage")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể cập nhật ảnh đại diện shop.")
  }
}

export async function updateShopProfileAction(
  values: UpdateShopProfileValues
): Promise<ActionState> {
  const parsed = updateShopProfileSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại thông tin shop.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const response = await updateShop(parsed.data)
    revalidatePath("/shop-manage")
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể cập nhật shop.")
  }
}

export async function shopOwnerUpgradeAction(
  values: ShopOwnerUpgradeValues
): Promise<ActionState> {
  const parsed = shopOwnerUpgradeSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại đơn nâng cấp shop.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const response = await createShopOwnerUpgrade({
      ...parsed.data,
      message: parsed.data.message || undefined,
    })
    return { success: true, message: response.message }
  } catch (error) {
    return toState(error, "Không thể gửi yêu cầu nâng cấp shop.")
  }
}
