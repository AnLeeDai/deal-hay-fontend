"use client"

import { usePathname } from "next/navigation"

import {
  ADSENSE_SCRIPT_URL,
  isStorefrontAdvertisingPath,
} from "@/config/advertising"

export function StorefrontAdvertising() {
  const pathname = usePathname()

  if (!isStorefrontAdvertisingPath(pathname)) return null

  // React hoists this async script into <head> and deduplicates it by src.
  return (
    <script
      id="google-adsense"
      async
      src={ADSENSE_SCRIPT_URL}
      crossOrigin="anonymous"
    />
  )
}
