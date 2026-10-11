import type { Metadata } from "next"

import { HomePageContainer } from "@/modules/public/containers/home-page-container"

export const metadata: Metadata = {
  title: "Trang chủ",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  return <HomePageContainer category={category} />
}
