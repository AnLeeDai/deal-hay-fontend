"use client"

import Link from "next/link"
import {
  BellIcon,
  HouseIcon,
  LayoutDashboardIcon,
  MenuIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  StoreIcon,
  UserRoundIcon,
} from "lucide-react"

import { SignOutButton } from "@/components/layout/sign-out-button"
import { UnreadCountBadge } from "@/components/layout/unread-count-badge"
import { useRealtime } from "@/components/realtime-provider"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { UserAvatar } from "@/components/user-avatar"
import type { User } from "@/types/auth"

const publicItems = [
  { href: "/", label: "Khám phá sản phẩm", icon: HouseIcon },
  {
    href: "/chats",
    label: "Tin nhắn",
    icon: MessageCircleIcon,
    unreadKey: "messages",
  },
  {
    href: "/notifications",
    label: "Thông báo",
    icon: BellIcon,
    unreadKey: "notifications",
  },
  { href: "/profile", label: "Hồ sơ cá nhân", icon: UserRoundIcon },
] as const

export function MobileNavigation({ user }: { user: User | null }) {
  const { unreadCounts } = useRealtime()
  return (
    <Sheet>
      <SheetTrigger
        render={<Button aria-label="Mở menu" size="icon" variant="ghost" />}
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent className="w-[88%]" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>Deal Hay</SheetTitle>
          <SheetDescription>
            Khám phá, mua sắm và quản lý tài khoản.
          </SheetDescription>
        </SheetHeader>

        {user ? (
          <div className="flex items-center gap-3 px-4 pt-1">
            <UserAvatar
              className="size-11"
              name={user.full_name}
              size="lg"
              src={user.avatar_url}
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{user.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        ) : null}

        <nav
          className="flex flex-col gap-1 px-3"
          aria-label="Điều hướng di động"
        >
          {publicItems.map((item) => {
            const count = "unreadKey" in item ? unreadCounts[item.unreadKey] : 0

            return (
              <Button
                key={item.href}
                aria-label={
                  count > 0 ? `${item.label}, ${count} chưa đọc` : item.label
                }
                className="justify-start"
                nativeButton={false}
                render={<Link href={item.href} />}
                variant="ghost"
              >
                <item.icon /> {item.label}
                <UnreadCountBadge className="ml-auto" count={count} />
              </Button>
            )
          })}
          {user?.role === "shop_owner" ? (
            <Button
              className="justify-start"
              nativeButton={false}
              render={<Link href="/shop-manage" />}
              variant="ghost"
            >
              <StoreIcon /> Kênh người bán
            </Button>
          ) : null}
          {user?.role === "administrator" ? (
            <Button
              className="justify-start"
              nativeButton={false}
              render={<Link href="/admin/users" />}
              variant="ghost"
            >
              <LayoutDashboardIcon /> Trung tâm quản trị
            </Button>
          ) : null}
        </nav>

        <div className="mt-auto space-y-3 border-t p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-4 text-primary" /> Giao dịch minh
            bạch và an toàn
          </div>
          <Separator />
          {user ? (
            <SignOutButton className="w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                nativeButton={false}
                render={<Link href="/sign-in" />}
                variant="outline"
              >
                Đăng nhập
              </Button>
              <Button nativeButton={false} render={<Link href="/sign-up" />}>
                Đăng ký
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
