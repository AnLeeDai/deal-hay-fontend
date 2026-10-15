"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"

import {
  ADSTERRA_SMARTLINK_URL,
  ADSTERRA_WEBSITE_SCRIPTS,
  isStorefrontAdvertisingPath,
} from "@/config/advertising"

export function StorefrontAdvertising() {
  const pathname = usePathname()

  if (!isStorefrontAdvertisingPath(pathname)) return null

  return (
    <>
      <aside
        aria-label="Quảng cáo đối tác"
        className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm"
      >
        <div>
          <p className="font-medium">Quảng cáo đối tác</p>
          <p className="text-xs text-muted-foreground">
            Nội dung quảng cáo do Adsterra cung cấp.
          </p>
        </div>
        <a
          className="text-primary underline underline-offset-4"
          href={ADSTERRA_SMARTLINK_URL}
          target="_blank"
          rel="noopener noreferrer sponsored"
        >
          Xem quảng cáo Adsterra
        </a>
      </aside>
      {ADSTERRA_WEBSITE_SCRIPTS.map((src, index) => (
        <Script
          key={src}
          id={`adsterra-website-${index + 1}`}
          src={src}
          strategy="afterInteractive"
        />
      ))}
    </>
  )
}
