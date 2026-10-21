import type { Metadata } from "next"

import { ResetPasswordPageContainer } from "@/modules/auth/containers/reset-password-page-container"

export const metadata: Metadata = { title: "Đặt lại mật khẩu" }

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>
}) {
  const { email, token } = await searchParams
  return <ResetPasswordPageContainer email={email} token={token} />
}
