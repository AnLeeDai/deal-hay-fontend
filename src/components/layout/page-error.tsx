"use client"

import { useEffect } from "react"
import { TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => console.error(error), [error])

  return (
    <Empty className="min-h-[55svh] border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Không thể tải nội dung</EmptyTitle>
        <EmptyDescription>
          Đã có lỗi xảy ra khi kết nối tới hệ thống. Vui lòng thử lại sau ít
          phút.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={reset}>Thử tải lại</Button>
      </EmptyContent>
    </Empty>
  )
}
