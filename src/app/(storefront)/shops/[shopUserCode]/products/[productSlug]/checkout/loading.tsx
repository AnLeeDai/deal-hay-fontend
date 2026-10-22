import { Skeleton } from "@/components/ui/skeleton"

export default function ProductCheckoutLoading() {
  return (
    <div
      aria-label="Đang tải trang đặt hàng"
      role="status"
      className="space-y-8"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6 rounded-xl border bg-card p-6">
          <Skeleton className="h-6 w-44" />
          <div className="flex gap-4">
            <Skeleton className="size-24 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  )
}
