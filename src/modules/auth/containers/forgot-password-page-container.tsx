import { AuthShell } from "@/modules/auth/containers/auth-shell"
import { ForgotPasswordForm } from "@/modules/auth/components/forgot-password-form"

export async function ForgotPasswordPageContainer() {
  return (
    <AuthShell
      title="Khôi phục quyền truy cập"
      description="Gửi yêu cầu đến API Laravel để nhận email đặt lại mật khẩu và quay lại công việc thật nhanh."
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
