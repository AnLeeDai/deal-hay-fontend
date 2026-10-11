import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initials } from "@/lib/format"

type UserAvatarProps = {
  name: string
  src: string | null | undefined
  size?: "default" | "sm" | "lg"
  className?: string
}

export function UserAvatar({
  name,
  src,
  size = "default",
  className,
}: UserAvatarProps) {
  return (
    <Avatar className={className} size={size}>
      <AvatarImage alt={name} src={src ?? undefined} />
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
