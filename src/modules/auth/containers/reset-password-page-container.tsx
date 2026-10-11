import { AuthShell } from "@/modules/auth/containers/auth-shell"
import { ResetPasswordForm } from "@/modules/auth/components/reset-password-form"

export async function ResetPasswordPageContainer({
  email,
  token,
}: {
  email?: string
  token?: string
}) {
  return (
    <AuthShell
      title="Đặt lại mật khẩu mới"
      description="Hoàn tất quy trình khôi phục mật khẩu bằng token được gửi từ backend."
    >
      <ResetPasswordForm email={email} token={token} />
    </AuthShell>
  )
}
