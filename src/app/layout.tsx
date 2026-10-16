import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "@/app/globals.css"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { RealtimeRoot } from "@/components/realtime-root"
import { StorefrontAdvertising } from "@/components/storefront-advertising"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ADSENSE_CLIENT_ID } from "@/config/advertising"
import { cn } from "@/lib/utils"

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
})
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: {
    default: "Deal Hay",
    template: "%s | Deal Hay",
  },
  description:
    "Khám phá sản phẩm, kết nối trực tiếp với cửa hàng uy tín và săn những deal hay mỗi ngày.",
  other: {
    "google-adsense-account": ADSENSE_CLIENT_ID,
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={cn("antialiased", inter.variable, fontMono.variable)}
    >
      <body className="min-h-svh bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider>
            <RealtimeRoot>
              <div className="flex min-h-svh flex-col">
                <SiteHeader />
                <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
                  {children}
                  <StorefrontAdvertising />
                </main>
                <SiteFooter />
              </div>
              <Toaster position="top-right" richColors />
            </RealtimeRoot>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
