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
const stagedSchema = z.object({
  uploads: z
    .array(z.object({ token: z.string().min(1).max(2048) }))
    .min(1)
    .max(51),
})
export async function discardProductImageUploadsAction(tokens: string[]) {
  const parsed = z.array(z.string().min(1).max(2048)).max(51).safeParse(tokens)
  if (!parsed.success || parsed.data.length === 0) return
  try {
    await apiFetch({
      method: "DELETE",
      path: "/private/uploads/images/staged",
      body: { tokens: parsed.data },
    })
  } catch {
    // The scheduled staged-upload cleanup also removes abandoned images.
  }
}

export async function requestProductImageUploadsAction(
  uploads: { size: number; content_type: string }[]
): Promise<ActionState & { data?: { tokens: string[] } }> {
  const parsed = z
    .array(
      z.object({
        size: z
          .number()
          .int()
          .min(1)
          .max(512 * 1024),
        content_type: z.enum([
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/avif",
          "image/bmp",
        ]),
      })
    )
    .min(1)
    .max(51)
    .safeParse(uploads)
  if (!parsed.success) {
    return { success: false, message: "Thông tin tải ảnh không hợp lệ." }
  }
  try {
    const response = await apiFetch({
      method: "POST",
      path: "/private/uploads/images",
      body: { uploads: parsed.data },
    })
    const data = stagedSchema.parse(response)
    if (data.uploads.length !== uploads.length) {
      await discardProductImageUploadsAction(
        data.uploads.map((upload) => upload.token)
      )
      return { success: false, message: "Không thể chuẩn bị đủ phiên tải ảnh." }
    }
    return {
      success: true,
      message: "",
      data: { tokens: data.uploads.map((upload) => upload.token) },
    }
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
