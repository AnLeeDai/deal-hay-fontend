import Link from "next/link"
import {
  BadgeCheckIcon,
  HeartHandshakeIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { Separator } from "@/components/ui/separator"

const footerLinks = [
  { href: "/", label: "Khám phá sản phẩm" },
  { href: "/profile", label: "Tài khoản của tôi" },
  { href: "/chats", label: "Tin nhắn" },
  { href: "/shop-manage", label: "Kênh người bán" },
]

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.25fr_0.75fr_1fr] lg:px-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
              D
            </span>
            <span className="font-heading text-xl font-bold">
              Deal<span className="text-primary">Hay</span>
            </span>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Nền tảng kết nối người mua với những gian hàng đáng tin cậy, giúp
            bạn tìm đúng sản phẩm và trao đổi trực tiếp với người bán.
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Liên kết nhanh</p>
          <nav className="grid gap-2 text-sm text-muted-foreground">
            {footerLinks.map((item) => (
              <Link
                key={item.href}
                className="w-fit hover:text-primary"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold">Cam kết của Deal Hay</p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheckIcon className="size-4 text-primary" /> Bảo vệ thông tin
            tài khoản
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <BadgeCheckIcon className="size-4 text-primary" /> Thông tin sản
            phẩm minh bạch
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <HeartHandshakeIcon className="size-4 text-primary" /> Hỗ trợ khi có
            khiếu nại
          </p>
        </div>
      </div>
      <Separator />
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© 2026 Deal Hay. All rights reserved.</p>
        <p>Mua sắm thông minh, kết nối trực tiếp.</p>
      </div>
    </footer>
  )
}
