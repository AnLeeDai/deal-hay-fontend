"use client"

import { useState, useTransition } from "react"
import { ActivityIcon, LoaderCircleIcon } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { measureDiagnosticsAction } from "@/modules/diagnostics/actions"
import type {
  DiagnosticsMeasurement,
  DiagnosticsResponse,
  DiagnosticCheck,
} from "@/types/diagnostics"

const checks: {
  key: keyof DiagnosticsResponse["checks"]
  title: string
  description: string
}[] = [
  {
    key: "database",
    title: "Cơ sở dữ liệu",
    description: "API → database, SELECT 1 trên kết nối hiện tại.",
  },
  {
    key: "cache",
    title: "Cache dùng chung",
    description: "API → cache, đọc một khóa kiểm tra.",
  },
  {
    key: "storage",
    title: "Kho lưu trữ ảnh",
    description: "API → R2, kiểm tra bucket.",
  },
  {
    key: "reverb",
    title: "Realtime",
    description: "API → Reverb, bắt tay WebSocket, gồm TLS nếu dùng HTTPS.",
  },
]

function milliseconds(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value)} ms`
}

function checkedAt(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Bangkok",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value))
}

function CheckStatus({
  status,
}: {
  status: DiagnosticCheck["status"] | undefined
}) {
  if (status === "ok") return <Badge>Hoạt động</Badge>
  if (status === "failed") return <Badge variant="destructive">Lỗi</Badge>
  if (status === "skipped") return <Badge variant="secondary">Bỏ qua</Badge>
  return <Badge variant="outline">Chưa đo</Badge>
}

export function DiagnosticsClient() {
  const [isPending, startTransition] = useTransition()
  const [measurement, setMeasurement] = useState<DiagnosticsMeasurement | null>(
    null
  )
  const [browserLatency, setBrowserLatency] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function measure() {
    setMeasurement(null)
    setBrowserLatency(null)
    setError(null)

    startTransition(async () => {
      const startedAt = performance.now()

      try {
        const result = await measureDiagnosticsAction()

        if (!result.success) {
          setError(result.message)
          return
        }

        setMeasurement(result.data)
        setBrowserLatency(performance.now() - startedAt)
      } catch {
        setError(
          "Không thể kết nối để đo độ trễ. Vui lòng tải lại trang rồi thử lại."
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Độ trễ hệ thống"
        description="Kiểm tra thời gian phản hồi giữa ứng dụng và các dịch vụ đang kết nối."
        actions={
          <Button type="button" disabled={isPending} onClick={measure}>
            {isPending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <ActivityIcon />
            )}
            {isPending ? "Đang đo..." : "Đo độ trễ"}
          </Button>
        }
      />
      <div className="space-y-6" aria-busy={isPending} aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>Chỉ đo khi nhấn nút, tối đa 6 lần mỗi phút cho mỗi tài khoản.</p>
          <p>
            {isPending
              ? "Đang kiểm tra các dịch vụ..."
              : measurement
                ? `Dịch vụ được kiểm tra lúc: ${checkedAt(measurement.checked_at)}`
                : "Chưa có kết quả đo."}
          </p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Trình duyệt → ứng dụng",
              value: browserLatency,
              description:
                "Toàn bộ lượt gọi qua Next.js, gồm xác thực và kiểm tra API.",
            },
            {
              title: "Next.js → API",
              value: measurement?.api_latency_ms,
              description:
                "Tổng thời gian HTTP, gồm API xử lý và kiểm tra các dịch vụ.",
            },
            {
              title: "API kiểm tra dịch vụ",
              value: measurement?.duration_ms,
              description:
                "Tổng thời gian của lần kiểm tra dịch vụ gần nhất, có thể được dùng lại trong 15 giây.",
            },
          ].map((metric) => (
            <Card key={metric.title}>
              <CardHeader>
                <CardTitle>{metric.title}</CardTitle>
                <CardDescription>{metric.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">
                  {milliseconds(metric.value)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {checks.map((check) => {
            const result = measurement?.checks[check.key]

            return (
              <Card key={check.key}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{check.title}</CardTitle>
                    <CheckStatus status={result?.status} />
                  </div>
                  <CardDescription>{check.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tabular-nums">
                    {milliseconds(result?.latency_ms)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result?.message ?? "Nhấn Đo độ trễ để kiểm tra."}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <p className="text-sm text-muted-foreground">
          Đây là thời gian thực hiện yêu cầu và xử lý phản hồi, không phải ping
          mạng thuần túy. Kết quả dịch vụ được lưu trong tối đa 15 giây; thời
          gian gọi từ trình duyệt và Next.js được đo lại mỗi lần nhấn. Kho lưu
          trữ hoặc realtime chưa được cấu hình sẽ được đánh dấu Bỏ qua.
        </p>
      </div>
    </div>
  )
}
