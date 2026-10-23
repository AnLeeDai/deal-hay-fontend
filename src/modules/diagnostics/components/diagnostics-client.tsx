"use client"

import { useId, useState } from "react"
import {
  ActivityIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleStopIcon,
  GlobeIcon,
  InfoIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  ServerIcon,
  SignalIcon,
  WifiIcon,
} from "lucide-react"
import { cn } from "cn"

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
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSpeedtest } from "@/modules/diagnostics/hooks/use-speedtest"
import type { SpeedtestPhase, SpeedtestState } from "@/types/speedtest"

const steps = [
  { phase: "connecting", label: "Kết nối", icon: GlobeIcon },
  { phase: "ping", label: "Ping", icon: ActivityIcon },
  { phase: "download", label: "Tải xuống", icon: ArrowDownIcon },
  { phase: "upload", label: "Tải lên", icon: ArrowUpIcon },
] as const

const phaseLabels: Record<SpeedtestPhase, string> = {
  idle: "Sẵn sàng kiểm tra",
  connecting: "Đang kết nối đến máy chủ",
  ping: "Đang đo ping và độ dao động",
  download: "Đang đo tốc độ tải xuống",
  upload: "Đang đo tốc độ tải lên",
  complete: "Đã hoàn tất lượt đo",
  error: "Lượt đo chưa hoàn tất",
  cancelled: "Đã dừng lượt đo",
}

function number(value: number | null, maximumFractionDigits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—"

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits,
  }).format(value)
}

function measuredAt(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Bangkok",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value))
}

function MetricHelp({ label, children }: { label: string; children: string }) {
  const descriptionId = useId()
  const [open, setOpen] = useState(false)

  return (
    <Tooltip onOpenChange={setOpen}>
      <TooltipTrigger
        aria-label={`Giải thích ${label}`}
        aria-describedby={open ? descriptionId : undefined}
        className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <InfoIcon aria-hidden="true" className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent
        id={descriptionId}
        role="tooltip"
        className="motion-reduce:animate-none"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  )
}

function MeasurementSteps({ phase }: { phase: SpeedtestPhase }) {
  const currentStep = steps.findIndex((step) => step.phase === phase)

  return (
    <ol
      aria-label="Các bước đo kết nối"
      className="grid grid-cols-4 gap-2 border-b px-4 pb-5 sm:gap-4 sm:px-6"
    >
      {steps.map((step, index) => {
        const active = phase === step.phase
        const completed = phase === "complete" || currentStep > index
        const Icon = completed ? CheckIcon : step.icon

        return (
          <li
            key={step.phase}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex flex-col items-center gap-2 text-center text-xs text-muted-foreground sm:flex-row sm:justify-center sm:text-sm",
              active && "font-medium text-primary",
              completed && "text-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted sm:size-9",
                active && "bg-primary/10 ring-1 ring-primary/25",
                completed && "bg-primary/10 text-primary"
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span>{step.label}</span>
            {completed ? <span className="sr-only">, đã hoàn tất</span> : null}
          </li>
        )
      })}
    </ol>
  )
}

function SpeedGauge({
  state,
  running,
  start,
}: {
  state: SpeedtestState
  running: boolean
  start: () => void
}) {
  const { phase } = state
  const showStart = !running && phase !== "complete"
  const isThroughput = phase === "download" || phase === "upload"
  const value =
    phase === "complete"
      ? state.downloadMbps
      : isThroughput
        ? state.liveMbps
        : state.pingMs
  const progress = Math.min(100, Math.max(0, state.progress))
  const circleColor = phase === "upload" ? "text-chart-3" : "text-primary"

  return (
    <div className="flex min-w-0 flex-col items-center justify-center py-2 sm:py-4">
      <div className="relative size-56 min-[380px]:size-64 sm:size-72">
        <svg
          aria-hidden="true"
          viewBox="0 0 280 280"
          className="absolute inset-0 size-full -rotate-90"
        >
          <circle
            cx="140"
            cy="140"
            r="125"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-border"
          />
          <circle
            cx="140"
            cy="140"
            r="111"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted"
          />
          <circle
            cx="140"
            cy="140"
            r="111"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${phase === "idle" ? 100 : progress} 100`}
            className={cn(
              "transition-[stroke-dasharray,color] duration-500 motion-reduce:transition-none",
              circleColor,
              phase === "idle" && "opacity-30"
            )}
          />
        </svg>

        <div className="absolute inset-8 flex flex-col items-center justify-center text-center">
          {showStart ? (
            <Button
              type="button"
              onClick={start}
              aria-describedby="speedtest-data-note"
              className="size-40 flex-col gap-3 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/15 min-[380px]:size-44 sm:size-48"
            >
              {phase === "idle" ? (
                <WifiIcon aria-hidden="true" className="size-7" />
              ) : (
                <RefreshCwIcon aria-hidden="true" className="size-7" />
              )}
              <span className="text-xl font-semibold tracking-wide">
                {phase === "idle" ? "BẮT ĐẦU" : "ĐO LẠI"}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                Ping · Tải xuống · Tải lên
              </span>
            </Button>
          ) : phase === "connecting" ? (
            <>
              <LoaderCircleIcon
                aria-hidden="true"
                className="mb-4 size-9 animate-spin text-primary motion-reduce:animate-none"
              />
              <span className="text-lg font-medium">Đang kết nối</span>
              <span className="mt-2 text-sm text-muted-foreground">
                Chuẩn bị lượt đo
              </span>
            </>
          ) : (
            <>
              <span className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                {phase === "complete" ? (
                  <CircleCheckIcon
                    aria-hidden="true"
                    className="size-4 text-primary"
                  />
                ) : null}
                {phase === "ping"
                  ? "Ping"
                  : phase === "upload"
                    ? "Tải lên"
                    : "Tải xuống"}
              </span>
              <span className="text-5xl leading-none font-semibold tracking-tighter tabular-nums sm:text-6xl">
                {number(value)}
              </span>
              <span className="mt-3 text-sm text-muted-foreground">
                {phase === "ping" ? "ms" : "Mbps"}
              </span>
              {phase === "complete" ? (
                <span className="mt-3 text-xs font-medium text-primary">
                  Đã hoàn tất
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
      <p className="mt-1 min-h-5 text-center text-xs text-muted-foreground">
        {running
          ? "Vòng tròn hiển thị tiến độ lượt đo"
          : phase === "complete"
            ? "Tốc độ tải xuống trung bình của lượt đo"
            : "Kiểm tra kết nối ngay trên trình duyệt"}
      </p>
      {showStart ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Tối đa khoảng 40 MiB dữ liệu / lượt đo
        </p>
      ) : null}
    </div>
  )
}

function ThroughputChart({ samples }: { samples: SpeedtestState["samples"] }) {
  const chartId = useId()
  const allSamples = [...samples.download, ...samples.upload]
  const hasSamples = allSamples.length > 0
  const maxMbps = Math.max(1, ...allSamples.map((sample) => sample.mbps))
  const left = 0
  const right = 640
  const top = 8
  const bottom = 104

  function points(series: SpeedtestState["samples"]["download"]) {
    if (series.length === 0) return ""

    const firstTime = series[0].elapsedMs
    const duration = Math.max(
      1,
      series[series.length - 1].elapsedMs - firstTime
    )

    return series
      .map((sample) => {
        const x =
          left + ((sample.elapsedMs - firstTime) / duration) * (right - left)
        const y = bottom - (sample.mbps / maxMbps) * (bottom - top)

        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(" ")
  }

  return (
    <div className="rounded-xl border bg-background/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">
          Tốc độ theo từng lượt truyền
        </h3>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-primary" />
            Tải xuống
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-chart-3" />
            Tải lên
          </span>
        </div>
      </div>
      <div className="relative mt-3 pl-8">
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 text-[10px] text-muted-foreground"
        >
          {hasSamples ? number(maxMbps, 0) : ""}
        </span>
        <span
          aria-hidden="true"
          className="absolute bottom-6 left-0 text-[10px] text-muted-foreground"
        >
          0
        </span>
        <svg
          viewBox="0 0 640 112"
          preserveAspectRatio="none"
          className="h-24 w-full overflow-visible"
          role="img"
          aria-labelledby={chartId}
        >
          <title id={chartId}>
            {hasSamples
              ? `Diễn biến tốc độ tải xuống và tải lên, đơn vị Mbps. Tốc độ cao nhất đã đo: ${number(Math.max(...allSamples.map((sample) => sample.mbps)))} Mbps.`
              : "Biểu đồ tốc độ. Chưa có dữ liệu, hãy bắt đầu lượt đo."}
          </title>
          {[top, (top + bottom) / 2, bottom].map((y) => (
            <line
              key={y}
              x1={left}
              x2={right}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeDasharray={y === bottom ? undefined : "3 5"}
              className="text-border"
            />
          ))}
          {samples.download.length > 0 ? (
            <polyline
              points={points(samples.download)}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="text-primary"
            />
          ) : null}
          {samples.upload.length > 0 ? (
            <polyline
              points={points(samples.upload)}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="text-chart-3"
            />
          ) : null}
        </svg>
        <div
          aria-hidden="true"
          className="mt-2 flex justify-between text-[10px] text-muted-foreground"
        >
          <span>Bắt đầu</span>
          <span>Cuối lượt truyền</span>
        </div>
        {!hasSamples ? (
          <p className="absolute inset-0 flex items-center justify-center pb-4 text-xs text-muted-foreground">
            Biểu đồ xuất hiện khi bắt đầu truyền dữ liệu
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function DiagnosticsClient() {
  const { state, start, cancel, running } = useSpeedtest()
  const { phase } = state
  const progress = Math.min(100, Math.max(0, state.progress))
  const hasAttempt = phase !== "idle"
  const downloadValue =
    phase === "download" ? state.liveMbps : state.downloadMbps
  const uploadValue = phase === "upload" ? state.liveMbps : state.uploadMbps

  return (
    <TooltipProvider delay={200}>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="Đo tốc độ kết nối"
          description="Đo ping, tốc độ tải xuống và tải lên từ thiết bị của bạn đến máy chủ DealHay."
        />

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <SignalIcon
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                Kết nối của bạn với DealHay
              </CardTitle>
              <CardDescription className="mt-1">
                Đo tốc độ truy cập DealHay trên đường truyền bạn đang sử dụng
              </CardDescription>
            </div>
            <Badge
              variant={phase === "error" ? "destructive" : "outline"}
              className="w-fit gap-1.5 px-2.5 py-1"
            >
              {running ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="size-3 animate-spin motion-reduce:animate-none"
                />
              ) : phase === "complete" ? (
                <CircleCheckIcon aria-hidden="true" className="size-3" />
              ) : null}
              {phase === "idle"
                ? "Đo theo yêu cầu"
                : running
                  ? "Đang đo"
                  : phase === "complete"
                    ? "Hoàn tất"
                    : phase === "cancelled"
                      ? "Đã dừng"
                      : "Chưa hoàn tất"}
            </Badge>
          </CardHeader>

          <MeasurementSteps phase={phase} />

          <CardContent className="gap-5 py-5 sm:py-7">
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {phaseLabels[phase]}
            </div>

            {state.error ? (
              <Alert variant="destructive">
                <AlertDescription>
                  <p>{state.error}</p>
                  <p>
                    Các số liệu hiển thị là kết quả tạm thời của lượt đo chưa
                    hoàn tất.
                  </p>
                </AlertDescription>
              </Alert>
            ) : null}

            {phase === "cancelled" ? (
              <p className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                Lượt đo đã dừng. Các số liệu bên dưới là kết quả đo được trước
                khi dừng.
              </p>
            ) : null}

            {state.pingMs !== null && state.pingMs >= 500 && !state.error ? (
              <Alert>
                <AlertDescription>
                  Phản hồi hiện chậm ({number(state.pingMs)} ms). Kết quả đo
                  phản ánh tốc độ truy cập DealHay, bao gồm thời gian chờ máy
                  chủ phản hồi và truyền dữ liệu.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid items-center gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10">
              <SpeedGauge state={state} running={running} start={start} />

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Tải xuống",
                      value: downloadValue,
                      active: phase === "download",
                      icon: ArrowDownIcon,
                      color: "text-primary",
                      background: "bg-primary/10",
                    },
                    {
                      label: "Tải lên",
                      value: uploadValue,
                      active: phase === "upload",
                      icon: ArrowUpIcon,
                      color: "text-chart-3",
                      background: "bg-chart-3/10",
                    },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className={cn(
                        "rounded-xl border bg-muted/20 px-4 py-4 transition-colors motion-reduce:transition-none sm:px-5",
                        metric.active && "border-primary/30 bg-primary/5"
                      )}
                    >
                      <div className="mb-4 flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full",
                            metric.background,
                            metric.color
                          )}
                        >
                          <metric.icon aria-hidden="true" className="size-4" />
                        </span>
                        <h2 className="text-sm font-medium">{metric.label}</h2>
                      </div>
                      <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                        {number(metric.value)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Mbps{metric.active ? " · Đang đo" : ""}
                      </p>
                    </div>
                  ))}
                </div>

                <dl className="grid grid-cols-2 divide-x rounded-xl border px-4 py-3">
                  <div className="pr-4">
                    <dt className="flex items-center gap-1 text-sm text-muted-foreground">
                      <ActivityIcon
                        aria-hidden="true"
                        className="mr-1 size-3.5"
                      />
                      Ping
                      <MetricHelp label="ping">
                        Trung vị thời gian khứ hồi của các yêu cầu HTTP từ trình
                        duyệt qua website đến DealHay Backend. Giá trị thấp hơn
                        cho biết phản hồi nhanh hơn.
                      </MetricHelp>
                    </dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">
                      {number(state.pingMs)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ms
                      </span>
                    </dd>
                  </div>
                  <div className="pl-4">
                    <dt className="flex items-center gap-1 text-sm text-muted-foreground">
                      Jitter
                      <MetricHelp label="jitter">
                        Mức dao động giữa các lần đo ping. Giá trị thấp hơn cho
                        biết thời gian phản hồi ổn định hơn.
                      </MetricHelp>
                    </dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">
                      {number(state.jitterMs)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ms
                      </span>
                    </dd>
                  </div>
                </dl>

                <ThroughputChart samples={state.samples} />
              </div>
            </div>

            {running ? (
              <div className="space-y-3 border-t pt-5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="font-medium">{phaseLabels[phase]}</p>
                  <span
                    aria-hidden="true"
                    className="text-muted-foreground tabular-nums"
                  >
                    {Math.floor(progress)}%
                  </span>
                </div>
                <Progress
                  value={progress}
                  aria-label="Tiến độ đo kết nối"
                  className="[&_[data-slot=progress-indicator]]:motion-reduce:transition-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Giữ trang này mở trong khi đo để kết quả ổn định hơn.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancel}
                  >
                    <CircleStopIcon aria-hidden="true" />
                    Dừng đo
                  </Button>
                </div>
              </div>
            ) : phase === "complete" ? (
              <div className="flex flex-col items-center justify-between gap-4 rounded-xl bg-primary/5 px-4 py-4 sm:flex-row">
                <div className="flex items-center gap-3">
                  <CircleCheckIcon
                    aria-hidden="true"
                    className="size-5 shrink-0 text-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">Đã hoàn tất lượt đo</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {state.completedAt
                        ? measuredAt(state.completedAt)
                        : "Kết quả của lượt đo vừa thực hiện"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={start}
                  aria-describedby="speedtest-data-note"
                >
                  <RefreshCwIcon aria-hidden="true" />
                  Đo lại
                </Button>
              </div>
            ) : null}
          </CardContent>

          <div className="flex flex-col gap-3 border-t bg-muted/20 px-6 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p className="flex min-w-0 items-center gap-2">
              <ServerIcon aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 break-all">
                Máy chủ:{" "}
                <span className="font-medium text-foreground">
                  DealHay Backend
                </span>
              </span>
            </p>
            {hasAttempt ? (
              <p className="shrink-0 tabular-nums">
                {number(state.elapsedMs / 1000)} giây ·{" "}
                {number(state.transferredBytes / (1024 * 1024), 2)} MiB đã
                truyền
              </p>
            ) : (
              <p>Trình duyệt → DealHay → DealHay Backend</p>
            )}
          </div>
        </Card>

        <div className="grid gap-4 text-sm sm:grid-cols-2 sm:gap-8">
          <div className="flex items-start gap-2.5">
            <InfoIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <p
              id="speedtest-data-note"
              className="text-xs leading-6 text-muted-foreground"
            >
              Mỗi lượt đo dùng tối đa khoảng 40 MiB dữ liệu. Lưu ý dung lượng
              nếu bạn đang dùng mạng di động. Chỉ bắt đầu truyền dữ liệu khi bạn
              nhấn Bắt đầu hoặc Đo lại.
            </p>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            Kết quả phản ánh đường truyền đến DealHay tại thời điểm đo. Ping là
            thời gian khứ hồi của yêu cầu HTTP qua website đến DealHay Backend.
            Tốc độ bao gồm thời gian máy chủ phản hồi và truyền dữ liệu, có thể
            thay đổi theo Wi-Fi, thiết bị, mạng và tải máy chủ.
          </p>
        </div>
      </div>
    </TooltipProvider>
  )
}
