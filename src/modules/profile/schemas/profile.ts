import { z } from "zod"

import {
  imageFileSchema,
  phoneNumberRegex,
  requiredText,
  strongPasswordRegex,
} from "@/lib/validation"

const optionalProfileString = z.union([
  z.string().trim().max(255, "Giá trị không được vượt quá 255 ký tự."),
  z.literal(""),
])
const optionalPhoneString = z.union([
  z.string().trim().regex(phoneNumberRegex, "Số điện thoại không hợp lệ."),
  z.literal(""),
])
const optionalMessageString = z.union([z.string().trim(), z.literal("")])

export const updateProfileSchema = z.object({
  full_name: requiredText("Vui lòng nhập họ và tên.").max(
    255,
    "Họ và tên không được vượt quá 255 ký tự."
  ),
  email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email.")
    .email("Email không đúng định dạng.")
    .max(255, "Email không được vượt quá 255 ký tự."),
  phone_number: optionalPhoneString,
  province: optionalProfileString,
  ward: optionalProfileString,
  address_detail: optionalProfileString,
})

export const updatePasswordSchema = z
  .object({
    current_password: requiredText("Vui lòng nhập mật khẩu hiện tại."),
    password: z
      .string()
      .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự.")
      .max(255, "Mật khẩu mới không được vượt quá 255 ký tự.")
      .regex(
        strongPasswordRegex,
        "Mật khẩu phải gồm chữ hoa, chữ thường, số và ký tự đặc biệt."
      ),
    password_confirmation: requiredText("Vui lòng xác nhận mật khẩu mới."),
  })
  .refine((value) => value.password !== value.current_password, {
    path: ["password"],
    message: "Mật khẩu mới phải khác mật khẩu hiện tại.",
  })
  .refine((value) => value.password === value.password_confirmation, {
    path: ["password_confirmation"],
    message: "Xác nhận mật khẩu mới không khớp.",
  })

export const avatarSchema = z.object({
  avatar: imageFileSchema("Vui lòng chọn ảnh đại diện hợp lệ."),
})

export const updateShopProfileSchema = z.object({
  shop_name: requiredText("Vui lòng nhập tên shop.").max(
    255,
    "Tên shop không được vượt quá 255 ký tự."
  ),
  shop_email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email shop.")
    .email("Email shop không đúng định dạng.")
    .max(255, "Email shop không được vượt quá 255 ký tự."),
  shop_phone_number: requiredText("Vui lòng nhập số điện thoại shop.").regex(
    phoneNumberRegex,
    "Số điện thoại shop không hợp lệ."
  ),
  shop_province: requiredText("Vui lòng nhập tỉnh/thành phố.").max(
    255,
    "Tỉnh hoặc thành phố của shop không được vượt quá 255 ký tự."
  ),
  shop_ward: requiredText("Vui lòng nhập phường/xã/đặc khu.").max(
    255,
    "Phường hoặc xã của shop không được vượt quá 255 ký tự."
  ),
  shop_address_detail: requiredText("Vui lòng nhập số nhà, tên đường.").max(
    255,
    "Địa chỉ chi tiết của shop không được vượt quá 255 ký tự."
  ),
})

export const shopOwnerUpgradeSchema = z.object({
  full_name: requiredText("Vui lòng nhập họ và tên.").max(
    255,
    "Họ và tên không được vượt quá 255 ký tự."
  ),
  shop_name: requiredText("Vui lòng nhập tên shop.").max(
    255,
    "Tên shop không được vượt quá 255 ký tự."
  ),
  email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email cá nhân.")
    .email("Email cá nhân không đúng định dạng.")
    .max(255, "Email cá nhân không được vượt quá 255 ký tự."),
  shop_email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email shop.")
    .email("Email shop không đúng định dạng.")
    .max(255, "Email shop không được vượt quá 255 ký tự."),
  phone_number: requiredText("Vui lòng nhập số điện thoại cá nhân.").regex(
    phoneNumberRegex,
    "Số điện thoại cá nhân không đúng định dạng."
  ),
  shop_phone_number: requiredText("Vui lòng nhập số điện thoại shop.").regex(
    phoneNumberRegex,
    "Số điện thoại shop không đúng định dạng."
  ),
  province: requiredText("Vui lòng nhập tỉnh/thành phố.").max(
    255,
    "Tỉnh/thành phố không được vượt quá 255 ký tự."
  ),
  ward: requiredText("Vui lòng nhập phường/xã/đặc khu.").max(
    255,
    "Phường/xã/đặc khu không được vượt quá 255 ký tự."
  ),
  address_detail: requiredText("Vui lòng nhập số nhà, tên đường.").max(
    255,
    "Địa chỉ chi tiết không được vượt quá 255 ký tự."
  ),
  message: optionalMessageString,
})

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>
export type UpdatePasswordValues = z.infer<typeof updatePasswordSchema>
export type AvatarValues = z.infer<typeof avatarSchema>
export type UpdateShopProfileValues = z.infer<typeof updateShopProfileSchema>
export type ShopOwnerUpgradeValues = z.infer<typeof shopOwnerUpgradeSchema>
