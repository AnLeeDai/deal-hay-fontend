"use server"

import { revalidatePath } from "next/cache"

import { ApiError, apiFetch } from "@/api/client"
import { getWards } from "@/api/lookups/queries"
import type { Ward } from "@/api/lookups/types"
import { shippingSettingsSchema } from "@/modules/shop-management/schemas/shipping-settings"
import type { ActionState } from "@/types/forms"
import type { ShippingSettings } from "@/types/shipping"

type ShippingSettingsResult = ActionState & {
  shipping_settings?: ShippingSettings
}

function toState(error: unknown, fallback: string): ActionState {
  if (error instanceof ApiError) {
    return { success: false, message: error.message, errors: error.errors }
  }
  return { success: false, message: fallback }
}

export async function loadShopShippingSettingsAction(): Promise<
  ShippingSettingsResult & { wards?: Ward[] }
> {
  try {
    const [response, wards] = await Promise.all([
      apiFetch<{ shipping_settings: ShippingSettings }>({
        path: "/shop/shipping-settings",
      }),
      getWards("1"),
    ])
    return {
      success: true,
      message: "",
      shipping_settings: response.shipping_settings,
      wards,
    }
  } catch (error) {
    return toState(
      error,
      "Không thể tải cài đặt phí vận chuyển. Vui lòng thử lại."
    )
  }
}

export async function updateShopShippingSettingsAction(
  values: ShippingSettings
): Promise<ShippingSettingsResult> {
  const parsed = shippingSettingsSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại phí vận chuyển.",
      errors: parsed.error.issues.reduce<Record<string, string[]>>(
        (errors, issue) => {
          const path = issue.path.join(".")
          ;(errors[path] ??= []).push(issue.message)
          return errors
        },
        {}
      ),
    }
  }

  try {
    const response = await apiFetch<{
      message?: string
      shipping_settings: ShippingSettings
    }>({
      method: "PUT",
      path: "/shop/shipping-settings",
      body: parsed.data,
    })
    revalidatePath("/shop-manage")
    return {
      success: true,
      message: response.message || "Đã lưu phí vận chuyển Hà Nội.",
      shipping_settings: response.shipping_settings,
    }
  } catch (error) {
    return toState(error, "Không thể lưu phí vận chuyển. Vui lòng thử lại.")
  }
}
