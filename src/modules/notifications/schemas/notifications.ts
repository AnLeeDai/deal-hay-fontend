import { z } from "zod"

import { requiredText } from "@/lib/validation"

export const notificationAppealSchema = z.object({
  notification_id: z.string().uuid("Không tìm thấy thông báo cần khiếu nại."),
  message: requiredText("Vui lòng nhập nội dung yêu cầu.")
    .min(10, "Nội dung yêu cầu phải có ít nhất 10 ký tự.")
    .max(1000, "Nội dung yêu cầu không được vượt quá 1000 ký tự."),
})

export type NotificationAppealValues = z.infer<typeof notificationAppealSchema>
