import { apiFetch } from "@/api/client"
import { authRoutes } from "@/api/auth/routes"
import type {
  ForgotPasswordPayload,
  LoginPayload,
  LoginResponse,
  LogoutResponse,
  RegisterPayload,
  RegisterResponse,
  ResetPasswordPayload,
} from "@/api/auth/types"

export function login(payload: LoginPayload): Promise<LoginResponse> {
  return apiFetch({ method: "POST", path: authRoutes.login, body: payload })
}

export function register(payload: RegisterPayload): Promise<RegisterResponse> {
  return apiFetch({ method: "POST", path: authRoutes.register, body: payload })
}

export function forgotPassword(
  payload: ForgotPasswordPayload
): Promise<{ message: string }> {
  return apiFetch({
    method: "POST",
    path: authRoutes.forgotPassword,
    body: payload,
  })
}

export function resetPassword(
  payload: ResetPasswordPayload
): Promise<{ message: string }> {
  return apiFetch({
    method: "POST",
    path: authRoutes.resetPassword,
    body: payload,
  })
}

export function logout(): Promise<LogoutResponse> {
  return apiFetch({ method: "POST", path: authRoutes.logout })
}
