import type { AuthPayload, SessionUser, User } from "@/types/auth"

export type LoginPayload = {
  email: string
  password: string
  admin_verification_code?: string
}

export type RegisterPayload = {
  email: string
  password: string
  password_confirmation: string
  accept_terms: boolean
}

export type ForgotPasswordPayload = { email: string }
export type ResetPasswordPayload = {
  email: string
  token: string
  password: string
  password_confirmation: string
}

export type MeResponse = {
  data: User
  meta: {
    unread_messages_count: number
    unread_notifications_count: number
  }
}
export type LoginResponse = AuthPayload
export type RegisterResponse = AuthPayload
export type LogoutResponse = { message: string }
export type SessionResponse = SessionUser
