import type { Metadata } from "next"

import { getSafeAuthRedirect } from "@/lib/auth-redirect"
import { SignUpPageContainer } from "@/modules/auth/containers/sign-up-page-container"

export const metadata: Metadata = { title: "Đăng ký" }

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>
}) {
  const { redirect } = await searchParams
  return <SignUpPageContainer redirectTo={getSafeAuthRedirect(redirect)} />
}
