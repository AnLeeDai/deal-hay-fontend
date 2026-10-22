import type { Metadata } from "next"
import Link from "next/link"
import { ShieldXIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export const metadata: Metadata = { title: "Không có quyền truy cập" }

export default function ForbiddenPage() {
  return (
    <Empty className="min-h-[55svh] border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldXIcon />
        </EmptyMedia>
        <EmptyTitle>Không có quyền truy cập</EmptyTitle>
        <EmptyDescription>
          Tài khoản hiện tại không được phép truy cập khu vực này.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href="/" className={buttonVariants()}>
          Về trang chủ
        </Link>
      </EmptyContent>
    </Empty>
  )
}
