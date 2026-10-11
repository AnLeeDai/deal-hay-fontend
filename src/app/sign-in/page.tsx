import type { Metadata } from "next"

import { getSafeAuthRedirect } from "@/lib/auth-redirect"
import { SignInPageContainer } from "@/modules/auth/containers/sign-in-page-container"

export const metadata: Metadata = { title: "Đăng nhập" }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>
}) {
  const { redirect } = await searchParams
  return <SignInPageContainer redirectTo={getSafeAuthRedirect(redirect)} />
}
