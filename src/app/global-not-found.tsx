import type { Metadata } from "next"

import "@/app/globals.css"
import NotFound from "@/components/layout/page-not-found"

export const metadata: Metadata = { title: "Không tìm thấy trang | Deal Hay" }

export default function GlobalNotFound() {
  return (
    <html lang="vi">
      <body className="bg-background text-foreground">
        <main className="mx-auto max-w-3xl px-4 py-10">
          <NotFound />
        </main>
      </body>
    </html>
  )
}
