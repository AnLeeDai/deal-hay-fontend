import { z } from "zod"

import { optionalFileSchema } from "@/lib/validation"

const optionalBodySchema = z.union([
  z.string().trim().max(2000, "Tin nhắn không được vượt quá 2.000 ký tự."),
  z.literal(""),
])

export const sendMessageSchema = z
  .object({
    body: optionalBodySchema,
    attachment: optionalFileSchema("Tệp đính kèm không hợp lệ."),
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

export type SendMessageValues = z.infer<typeof sendMessageSchema>
