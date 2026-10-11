"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { ApiError } from "@/api/client"
import {
  forgotPassword,
  login,
  logout,
  register,
  resetPassword,
} from "@/api/auth/mutations"
import { clearAuthCookies, setAuthCookies } from "@/lib/auth"
import type { ActionState } from "@/types/forms"
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordValues,
  type ResetPasswordValues,
  type SignInValues,
  type SignUpValues,
} from "@/modules/auth/schemas/auth"

function fromApiError(error: ApiError): ActionState {
  return {
    success: false,
    message: error.message,
    errors: error.errors,
  }
}

export async function signInAction(values: SignInValues): Promise<ActionState> {
  const parsed = signInSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại thông tin đăng nhập.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const payload = await login({
      email: parsed.data.email,
      password: parsed.data.password,
      admin_verification_code: parsed.data.admin_verification_code || undefined,
    })
    await setAuthCookies(payload)
    revalidatePath("/")
  } catch (error) {
    if (error instanceof ApiError) {
      return fromApiError(error)
    }
    return { success: false, message: "Không thể đăng nhập. Vui lòng thử lại." }
  }

  redirect("/")
}

export async function signUpAction(values: SignUpValues): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại thông tin đăng ký.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const payload = await register({
      email: parsed.data.email,
      password: parsed.data.password,
      password_confirmation: parsed.data.password_confirmation,
      accept_terms: parsed.data.accept_terms,
    })
    await setAuthCookies(payload)
    revalidatePath("/")
  } catch (error) {
    if (error instanceof ApiError) {
      return fromApiError(error)
    }
    return { success: false, message: "Không thể đăng ký. Vui lòng thử lại." }
  }

  redirect("/")
}

export async function forgotPasswordAction(
  values: ForgotPasswordValues
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng nhập email hợp lệ.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const response = await forgotPassword({ email: parsed.data.email })
    return { success: true, message: response.message }
  } catch (error) {
    if (error instanceof ApiError) {
      return fromApiError(error)
    }
    return { success: false, message: "Không thể gửi yêu cầu quên mật khẩu." }
  }
}

export async function resetPasswordAction(
  values: ResetPasswordValues
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại thông tin đặt lại mật khẩu.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const response = await resetPassword({
      email: parsed.data.email,
      token: parsed.data.token,
      password: parsed.data.password,
      password_confirmation: parsed.data.password_confirmation,
    })
    return { success: true, message: response.message }
  } catch (error) {
    if (error instanceof ApiError) {
      return fromApiError(error)
    }
    return { success: false, message: "Không thể đặt lại mật khẩu." }
  }
}

export async function signOutAction(): Promise<void> {
  try {
    await logout()
  } catch {
    // Ignore logout failures and clear local auth state anyway.
  }
  await clearAuthCookies()
  revalidatePath("/")
  redirect("/sign-in")
}
