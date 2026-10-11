"use client"

import { LogOutIcon } from "lucide-react"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { signOutAction } from "@/modules/auth/actions"

export function SignOutButton({ className }: { className?: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      className={cn(className)}
      disabled={isPending}
      type="button"
      variant="outline"
      onClick={() => startTransition(async () => signOutAction())}
    >
      <LogOutIcon /> {isPending ? "Đang đăng xuất..." : "Đăng xuất"}
    </Button>
  )
}
