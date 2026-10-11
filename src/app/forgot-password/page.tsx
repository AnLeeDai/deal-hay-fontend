import type { Metadata } from "next"

import { ForgotPasswordPageContainer } from "@/modules/auth/containers/forgot-password-page-container"

export const metadata: Metadata = { title: "Quên mật khẩu" }

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageContainer />
}
