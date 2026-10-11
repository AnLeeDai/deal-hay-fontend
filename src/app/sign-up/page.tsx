import type { Metadata } from "next"

import { SignUpPageContainer } from "@/modules/auth/containers/sign-up-page-container"

export const metadata: Metadata = { title: "Đăng ký" }

export default function SignUpPage() {
  return <SignUpPageContainer />
}
