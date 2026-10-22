import Link from "next/link"
import {
  BadgeCheckIcon,
  BellIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  StoreIcon,
  TicketPercentIcon,
  TruckIcon,
} from "lucide-react"

import { getCurrentSession } from "@/api/auth/queries"
import { MobileNavigation } from "@/components/layout/mobile-navigation"
import { NotificationSoundToggle } from "@/components/layout/notification-sound-toggle"
import { SignOutButton } from "@/components/layout/sign-out-button"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UnreadNavigationLink } from "@/components/layout/unread-count-badge"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { UserAvatar } from "@/components/user-avatar"

const navigation = [
  { href: "/", label: "Khám phá" },
  { href: "/diagnostics", label: "Độ trễ" },
  { href: "/chats", label: "Tin nhắn", unreadKey: "messages" },
  {
    href: "/notifications",
    label: "Thông báo",
    unreadKey: "notifications",
  },
] as const

export async function SiteHeader() {
  const { user } = await getCurrentSession()

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="hidden border-b bg-foreground text-background lg:block">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-8 text-xs">
          <p>Săn deal hay, mua sắm an tâm mỗi ngày</p>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <ShieldCheckIcon className="size-3.5" /> Giao dịch minh bạch
            </span>
            <span className="flex items-center gap-1.5">
              <TruckIcon className="size-3.5" /> Theo dõi đơn hàng
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeCheckIcon className="size-3.5" /> Gian hàng xác thực
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label="Deal Hay - Trang chủ"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-sm transition-transform group-hover:-rotate-3">
            D
          </span>
          <span className="hidden font-heading text-xl font-bold tracking-tight min-[360px]:inline">
            Deal<span className="text-primary">Hay</span>
          </span>
        </Link>

        <Separator className="hidden h-6 lg:block" orientation="vertical" />

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Điều hướng chính"
        >
          {navigation.map((item) => (
            <UnreadNavigationLink
              key={item.href}
              href={item.href}
              kind={"unreadKey" in item ? item.unreadKey : undefined}
              label={item.label}
            />
          ))}
          {user ? (
            <Link
              href="/discount-codes"
              className={buttonVariants({ variant: "ghost" })}
            >
              <TicketPercentIcon /> Mã giảm giá
            </Link>
          ) : null}
          {user?.role === "shop_owner" ? (
            <Link
              href="/shop-manage"
              className={buttonVariants({ variant: "ghost" })}
            >
              <StoreIcon /> Kênh người bán
            </Link>
          ) : null}
          {user?.role === "administrator" ? (
            <Link
              href="/admin/users"
              className={buttonVariants({ variant: "ghost" })}
            >
              Quản trị
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {user ? (
            <>
              <NotificationSoundToggle />
              <Link
                href="/profile"
                className={buttonVariants({
                  className: "h-10 gap-2",
                  variant: "ghost",
                })}
              >
                <UserAvatar
                  className="size-7"
                  name={user.full_name}
                  size="sm"
                  src={user.avatar_url}
                />
                <span className="max-w-32 truncate">{user.full_name}</span>
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "ghost" })}
              >
                Đăng nhập
              </Link>
              <Link href="/sign-up" className={buttonVariants()}>
                Tạo tài khoản
              </Link>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <UnreadNavigationLink
            badgeClassName="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
            className="relative"
            href="/chats"
            kind="messages"
            label="Mở tin nhắn"
            size="icon"
          >
            <MessageCircleIcon />
          </UnreadNavigationLink>
          <UnreadNavigationLink
            badgeClassName="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
            className="relative"
            href="/notifications"
            kind="notifications"
            label="Mở thông báo"
            size="icon"
          >
            <BellIcon />
          </UnreadNavigationLink>
          <ThemeToggle />
          <MobileNavigation user={user} />
        </div>
      </div>
    </header>
  )
}
