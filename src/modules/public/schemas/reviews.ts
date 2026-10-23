import { z } from "zod"

import {
  imageFileSchema,
  preparedImageFileSchema,
  requiredText,
} from "@/lib/validation"

export const reviewProductSchema = z.object({
  reaction: z.enum(["like", "dislike"], {
    message: "Lựa chọn đánh giá không hợp lệ.",
  }),
  content: requiredText("Vui lòng nhập nội dung đánh giá.")
    .min(5, "Nội dung đánh giá phải có ít nhất 5 ký tự.")
    .max(2000, "Nội dung đánh giá không được vượt quá 2.000 ký tự."),
  image: imageFileSchema("Ảnh đánh giá phải là một tệp hợp lệ.").optional(),
})

export const preparedReviewProductSchema = reviewProductSchema.extend({
  image: preparedImageFileSchema(
    "Ảnh đánh giá phải là một tệp hợp lệ."
  ).optional(),
})

export type ReviewProductValues = z.infer<typeof reviewProductSchema>
