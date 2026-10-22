import Link from "next/link"
import { SearchXIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default function NotFound() {
  return (
    <Empty className="min-h-[55svh] border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>Không tìm thấy nội dung</EmptyTitle>
        <EmptyDescription>
          Trang bạn đang tìm có thể đã được di chuyển, ẩn hoặc không còn tồn
          tại.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href="/" className={buttonVariants()}>
          Quay lại trang chủ
        </Link>
      </EmptyContent>
    </Empty>
  )
}
