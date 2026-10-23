import { z } from "zod"

import {
  chatAttachmentFileSchema,
  preparedImageFileSchema,
} from "@/lib/validation"

const optionalBodySchema = z.union([
  z.string().trim().max(2000, "Tin nhắn không được vượt quá 2.000 ký tự."),
  z.literal(""),
])

export const sendMessageSchema = z
  .object({
    body: optionalBodySchema,
    reply_to_id: z
      .string()
      .uuid("Tin nhắn được trả lời không hợp lệ.")
      .optional(),
    attachment: chatAttachmentFileSchema(
      "Tệp đính kèm không hợp lệ."
    ).optional(),
  })
  .superRefine((value, context) => {
    if (!value.body && !value.attachment) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "Vui lòng nhập nội dung hoặc chọn tệp đính kèm.",
      })
    }
  })

export const sendPreparedMessageSchema = sendMessageSchema.superRefine(
  (value, context) => {
    if (!value.attachment?.type.startsWith("image/")) return
    const image = preparedImageFileSchema(
      "Ảnh đính kèm không hợp lệ."
    ).safeParse(value.attachment)
    if (!image.success)
      image.error.issues.forEach((issue) =>
        context.addIssue({
          code: "custom",
          path: ["attachment"],
          message: issue.message,
        })
      )
  }
)

export type SendMessageValues = z.infer<typeof sendMessageSchema>
