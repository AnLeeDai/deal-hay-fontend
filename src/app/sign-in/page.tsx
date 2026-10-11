import type { Metadata } from "next"

import { SignInPageContainer } from "@/modules/auth/containers/sign-in-page-container"

export const metadata: Metadata = { title: "Đăng nhập" }

export default function SignInPage() {
  return <SignInPageContainer />
}
