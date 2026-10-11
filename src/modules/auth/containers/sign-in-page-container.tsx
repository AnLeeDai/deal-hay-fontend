import { AuthShell } from "@/modules/auth/containers/auth-shell"
import { SignInForm } from "@/modules/auth/components/sign-in-form"

export async function SignInPageContainer({
  redirectTo,
}: {
  redirectTo?: string
}) {
  return (
    <AuthShell
      title="Đăng nhập để tiếp tục với Deal Hay"
      description="Sử dụng tài khoản khách hàng, chủ shop hoặc quản trị viên để truy cập đúng khu vực làm việc của bạn."
    >
      <SignInForm redirectTo={redirectTo} />
    </AuthShell>
  )
}
