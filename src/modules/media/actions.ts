"use server"

import { z } from "zod"

import { apiFetch, ApiError } from "@/api/client"
import { IMAGE_UPLOAD_MAX_BYTES } from "@/lib/validation"
import type { ActionState } from "@/types/forms"
import type { BrowserImageGrant, ImagePurpose } from "@/types/media"

const requestSchema = z.object({
  size: z.number().int().min(1).max(IMAGE_UPLOAD_MAX_BYTES),
  purpose: z.enum(["avatar", "product", "review", "chat"]),
})
const grantSchema = z.object({ url: z.url(), token: z.string().min(1) })

export async function requestImageTransformAction(request: {
  size: number
  purpose: ImagePurpose
}): Promise<ActionState & { data?: BrowserImageGrant }> {
  const parsed = requestSchema.safeParse(request)

  if (!parsed.success) {
    return {
      success: false,
      message: "Thông tin tải ảnh không hợp lệ.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const grant = await apiFetch<BrowserImageGrant>({
      method: "POST",
      path: "/private/media/transform",
      body: parsed.data,
    })
    return { success: true, message: "", data: grantSchema.parse(grant) }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message, errors: error.errors }
    }
    return {
      success: false,
      message: "Không thể chuẩn bị tải ảnh. Vui lòng thử lại.",
    }
  }
}
