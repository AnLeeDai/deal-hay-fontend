import { AuthShell } from "@/modules/auth/containers/auth-shell"
import { SignUpForm } from "@/modules/auth/components/sign-up-form"

export async function SignUpPageContainer() {
  return (
    <AuthShell
      title="Tạo tài khoản Deal Hay mới"
      description="Đăng ký để theo dõi shop, gửi đánh giá sản phẩm, nhận thông báo và trò chuyện trực tiếp với người bán."
    >
      <SignUpForm />
    </AuthShell>
  )
}
