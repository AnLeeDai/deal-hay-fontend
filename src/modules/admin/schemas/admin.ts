import { z } from "zod"

import { requiredText } from "@/lib/validation"

const optionalAdminNoteSchema = z.union([
  z
    .string()
    .trim()
    .max(1000, "Ghi chú của quản trị viên không được vượt quá 1000 ký tự."),
  z.literal(""),
])

export const categorySchema = z.object({
  name: requiredText("Vui lòng nhập tên danh mục.").max(
    120,
    "Tên danh mục không được vượt quá 120 ký tự."
  ),
})

export const reviewTicketSchema = z
  .object({
    status: z.enum(["approved", "rejected"], {
      message: "Trạng thái ticket không hợp lệ.",
    }),
    admin_note: optionalAdminNoteSchema,
  })
  .superRefine((value, context) => {
    if (value.status === "rejected" && !value.admin_note) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["admin_note"],
        message: "Vui lòng nhập lý do từ chối ticket.",
      })
    }
  })

export const deleteShopProductSchema = z.object({
  reason: requiredText("Vui lòng nhập lý do xoá sản phẩm.")
    .min(5, "Lý do xoá sản phẩm phải có ít nhất 5 ký tự.")
    .max(1000, "Lý do xoá sản phẩm không được vượt quá 1000 ký tự."),
})

export type CategoryValues = z.infer<typeof categorySchema>
export type ReviewTicketValues = z.infer<typeof reviewTicketSchema>
export type DeleteShopProductValues = z.infer<typeof deleteShopProductSchema>
