"use client"

import Link from "next/link"
import {
  FolderTreeIcon,
  StoreIcon,
  TicketCheckIcon,
  UsersIcon,
} from "lucide-react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
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
          <Button
            key={item.href}
            nativeButton={false}
            render={<Link href={item.href} />}
            variant={pathname.startsWith(item.href) ? "default" : "outline"}
          >
            <item.icon /> {item.label}
          </Button>
        ))}
      </nav>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
