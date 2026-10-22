"use client"

import Link from "next/link"
import {
  FolderTreeIcon,
  StoreIcon,
  TicketCheckIcon,
  UsersIcon,
} from "lucide-react"
import { usePathname } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

const items = [
  { href: "/admin/users", label: "Người dùng", icon: UsersIcon },
  { href: "/admin/shops", label: "Cửa hàng", icon: StoreIcon },
  { href: "/admin/categories", label: "Danh mục", icon: FolderTreeIcon },
  { href: "/admin/tickets", label: "Yêu cầu hỗ trợ", icon: TicketCheckIcon },
]

export function AdminNavigation() {
  const pathname = usePathname()

  return (
    <ScrollArea className="w-full">
      <nav className="flex w-max gap-2 pb-3" aria-label="Điều hướng quản trị">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={buttonVariants({
              variant: pathname.startsWith(item.href) ? "default" : "outline",
            })}
          >
            <item.icon /> {item.label}
          </Link>
        ))}
      </nav>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
