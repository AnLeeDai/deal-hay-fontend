import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function UnreadCountBadge({
  className,
  count,
}: {
  className?: string
  count: number
}) {
  const unreadCount = Math.max(0, Math.trunc(count))

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
