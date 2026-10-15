"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"

import { ADSENSE_SCRIPT_URL, isAdSenseStorefrontPath } from "@/config/adsense"

export function StorefrontAdsense() {
  const pathname = usePathname()

  if (!isAdSenseStorefrontPath(pathname)) return null

  return (
    <Script
      async
      crossOrigin="anonymous"
      id="google-adsense"
      src={ADSENSE_SCRIPT_URL}
      strategy="afterInteractive"
    />
  )
}
