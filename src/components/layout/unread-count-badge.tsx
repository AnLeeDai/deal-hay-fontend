"use client"

import Link from "next/link"

import { useRealtime } from "@/components/realtime-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { UnreadCounts } from "@/types/auth"

export function UnreadCountBadge({
  className,
  count = 0,
  kind,
}: {
  className?: string
  count?: number
  kind?: keyof UnreadCounts
}) {
  const { unreadCounts } = useRealtime()
  const unreadCount = Math.max(0, Math.trunc(kind ? unreadCounts[kind] : count))

  if (unreadCount === 0) return null

  return (
    <Badge
      aria-label={`${unreadCount} chưa đọc`}
      className={cn(
        "min-w-5 bg-destructive px-1.5 text-white tabular-nums shadow-xs dark:text-white",
        className
      )}
      variant="destructive"
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </Badge>
  )
}

export function UnreadNavigationLink({
  href,
  label,
  kind,
  className,
  badgeClassName,
  size,
  children,
}: {
  href: string
  label: string
  kind?: keyof UnreadCounts
  className?: string
  badgeClassName?: string
  size?: React.ComponentProps<typeof Button>["size"]
  children?: React.ReactNode
}) {
  const { unreadCounts } = useRealtime()
  const count = kind ? unreadCounts[kind] : 0

  return (
    <Button
      aria-label={count > 0 ? `${label}, ${count} chưa đọc` : label}
      className={className}
      nativeButton={false}
      render={<Link href={href} />}
      size={size}
      variant="ghost"
    >
      {children ?? label}
      <UnreadCountBadge className={badgeClassName} count={count} />
    </Button>
  )
}
