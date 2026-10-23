"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { CameraIcon, DownloadIcon, RefreshCwIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"
import { AppSelect } from "@/components/app-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatCurrency, formatDate } from "@/lib/format"
import type { ShopProduct } from "@/types/shop"
import type {
  Stocktake,
  StocktakeItem,
  StocktakeSummary,
} from "@/types/inventory"
import {
  completeStocktakeAction,
  createStocktakeAction,
  getStocktakeAction,
  listStocktakesAction,
  saveStocktakeAction,
  scanStocktakeAction,
  undoStocktakeUnitAction,
} from "@/modules/shop-management/inventory-actions"
import { stocktakeCsv } from "@/modules/shop-management/lib/stocktake-report"
import { InventoryQrScanner } from "@/modules/shop-management/components/inventory-qr-scanner"
import { listStocktakeUnitsAction } from "@/modules/shop-management/inventory-unit-detail-actions"
import { StocktakeUnitList } from "@/modules/shop-management/components/stocktake-unit-list"
import { ShopInventoryUnitsPanel } from "@/modules/shop-management/components/shop-inventory-units-panel"
import {
  InventoryScanQueue,
  normalizeInventoryScanCode,
  type InventoryScanQueueState,
} from "@/modules/shop-management/lib/inventory-scan"

const resultOptions = [
  { value: "all", label: "Tất cả kết quả" },
  { value: "matched", label: "Đủ mã" },
  { value: "shortage", label: "Thiếu mã" },
  { value: "surplus", label: "Thừa mã" },
  { value: "unknown", label: "Không thuộc kho" },
]

function downloadReport(session: Stocktake) {
  const url = URL.createObjectURL(
    new Blob([stocktakeCsv(session)], { type: "text/csv;charset=utf-8" })
  )
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `kiem-ke-${session.id}.csv`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ItemResult({ item }: { item: StocktakeItem }) {
  if (item.is_unknown) return <Badge variant="outline">Mã lạ</Badge>
  const shortage = item.shortage_quantity ?? Math.max(0, -item.difference)
  const surplus = item.surplus_quantity ?? Math.max(0, item.difference)
  return (
    <div className="flex flex-wrap gap-1">
      {shortage > 0 && (
        <Badge variant="outline" className="text-destructive">
          Thiếu {shortage}
        </Badge>
      )}
      {surplus > 0 && <Badge variant="outline">Thừa {surplus}</Badge>}
      {shortage === 0 && surplus === 0 && (
        <Badge variant="secondary">Đủ mã</Badge>
      )}
    </div>
  )
}

export function ShopInventoryWorkspace({
  products,
}: {
  products: ShopProduct[]
}) {
  const stockLines = products.flatMap((product) =>
    product.has_variants
      ? product.variants
          .filter((variant) => !variant.retired_at)
          .map((variant) => variant.stock)
      : [product.stock]
  )
  const [history, setHistory] = useState<StocktakeSummary[]>([])
  const [historyError, setHistoryError] = useState("")
  const [session, setSession] = useState<Stocktake | null>(null)
  const [sessionName, setSessionName] = useState(
    () =>
      `Kiểm kê ${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Bangkok" }).format(new Date())}`
  )
  const [code, setCode] = useState("")
  const [camera, setCamera] = useState(false)
  const [resultFilter, setResultFilter] = useState("all")
  const [completeOpen, setCompleteOpen] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [lastScan, setLastScan] = useState("")
  const [inventoryRevision, setInventoryRevision] = useState(0)
  const [actionPending, startTransition] = useTransition()
  const scanInput = useRef<HTMLInputElement>(null)
  const focusAfterScan = useRef(false)
  const sessionRef = useRef<Stocktake | null>(null)
  const scanQueue = useRef(new InventoryScanQueue())
  const [queueState, setQueueState] = useState<InventoryScanQueueState>({
    queued: 0,
    running: false,
    error: null,
    nextCode: null,
  })
  const pending = actionPending || queueState.running
  const actionsDisabled = pending || queueState.queued > 0
  const scanDisabled = actionPending
  const serialized = session?.counting_mode === "serialized"
  const finance = session?.financial_summary

  useEffect(() => {
    if (!pending && focusAfterScan.current) {
      focusAfterScan.current = false
      scanInput.current?.focus()
    }
  }, [pending])

  useEffect(() => {
    let cancelled = false
    void listStocktakesAction()
      .then((result) => {
        if (cancelled) return
        if (result.success) setHistory(result.data)
        else setHistoryError(result.message)
      })
      .catch(() => {
        if (!cancelled)
          setHistoryError(
            "Không tải được danh sách phiên. Vui lòng tải lại trang."
          )
      })
    return () => {
      cancelled = true
    }
  }, [])

  function run(operation: () => Promise<void>) {
    startTransition(async () => {
      try {
        await operation()
      } catch {
        toast.error("Kết nối bị gián đoạn. Vui lòng thử lại thao tác.")
      }
    })
  }

  function receive(next: Stocktake, focusScan = false) {
    sessionRef.current = next
    if (
      focusScan &&
      next.counting_mode === "serialized" &&
      next.status === "counting"
    )
      focusAfterScan.current = true
    setSession(next)
    setReviewed(false)
    setHistory((previous) =>
      [next, ...previous.filter((item) => item.id !== next.id)].slice(0, 30)
    )
  }

  function drainScans() {
    void (async () => {
      try {
        await scanQueue.current.drain(
          (job) => scanStocktakeAction(job.sessionId, job.code, 1, job.id),
          (job, data) => {
            const sameCode = (value: string) =>
              normalizeInventoryScanCode(value) === job.code
            const alreadyCounted = sessionRef.current?.items.some(
              (item) =>
                (item.is_unknown &&
                  sameCode(item.code) &&
                  item.counted_quantity > 0) ||
                item.units?.some(
                  (unit) =>
                    (sameCode(unit.code) || sameCode(unit.sku)) && unit.counted
                )
            )
            const item = data.items.find(
              (item) =>
                item.units?.some(
                  (unit) => sameCode(unit.code) || sameCode(unit.sku)
                ) || sameCode(item.code)
            )
            receive(data)
            setLastScan(
              alreadyCounted
                ? "Tem này đã được kiểm; không cộng thêm số lượng."
                : item
                  ? `${item.product_name}: đã kiểm ${item.counted_quantity}/${item.expected_quantity}.`
                  : `Đã ghi nhận ${job.code}.`
            )
            if (item?.is_unknown)
              toast.warning(
                "Mã không thuộc kho, được ghi riêng và không tính công nợ."
              )
          },
          setQueueState
        )
      } catch {
        toast.error(
          "Không xử lý được hàng đợi. Các mã đang chờ vẫn được giữ để thử lại."
        )
      } finally {
        focusAfterScan.current = true
      }
    })()
  }

  function scan(scannedCode: string) {
    if (!scannedCode) return
    const current = sessionRef.current
    const queue = scanQueue.current
    if (
      !current ||
      current.counting_mode !== "serialized" ||
      current.status !== "counting" ||
      actionPending
    )
      return
    try {
      const paused = Boolean(queue.snapshot().error)
      queue.enqueue(current.id, scannedCode)
      setQueueState(queue.snapshot())
      setCamera(false)
      // Clear only the submitted input. Replies must never erase the next SKU being typed.
      setCode("")
      if (scanInput.current) {
        scanInput.current.value = ""
        scanInput.current.focus()
      }
      if (!queue.snapshot().running && !paused) drainScans()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không ghi nhận được mã quét."
      )
    }
  }

  function save() {
    if (!session) return
    setCamera(false)
    run(async () => {
      const result = await saveStocktakeAction(session.id)
      if (result.success) {
        receive(result.data, true)
        toast.success("Đã lưu phiên. Bạn có thể mở lại để tiếp tục kiểm kê.")
      } else toast.error(result.message)
    })
  }

  function exportSession() {
    if (!session) return
    setCamera(false)
    run(async () => {
      const fresh = await getStocktakeAction(session.id)
      if (!fresh.success) {
        toast.error(fresh.message)
        return
      }
      const report = fresh.data
      for (const item of report.items) {
        const total = item.units_total ?? item.units?.length ?? 0
        const entries = [...(item.units ?? [])]
        let page = 2
        while (entries.length < total) {
          const next = await listStocktakeUnitsAction(
            report.id,
            item.id,
            page++,
            100
          )
          if (!next.success) {
            toast.error(next.message)
            return
          }
          if (!next.data.data.length) {
            toast.error(
              "Danh sách mã đã thay đổi. Tải lại phiên rồi xuất biên bản."
            )
            return
          }
          entries.push(...next.data.data)
        }
        item.units = entries
      }
      const latest = await getStocktakeAction(report.id)
      if (!latest.success) {
        toast.error(latest.message)
        return
      }
      if (
        latest.data.status !== report.status ||
        latest.data.confirmation_token !== report.confirmation_token
      ) {
        receive(latest.data)
        toast.error(
          "Phiên vừa thay đổi trong lúc xuất. Kiểm tra lại và xuất biên bản mới."
        )
        return
      }
      downloadReport(report)
    })
  }

  function openConfirmation() {
    if (!session) return
    setCamera(false)
    run(async () => {
      const result = await getStocktakeAction(session.id)
      if (result.success) {
        receive(result.data)
        setCompleteOpen(true)
      } else toast.error(result.message)
    })
  }

  function complete(adjustStock: boolean) {
    if (!session || !reviewed) return
    run(async () => {
      const result = await completeStocktakeAction(
        session.id,
        adjustStock,
        session.confirmation_token,
        reviewed
      )
      if (result.success) {
        receive(result.data)
        setCompleteOpen(false)
        if (adjustStock) setInventoryRevision((revision) => revision + 1)
        toast.success(
          adjustStock
            ? "Đã xác nhận chốt số lượng, công nợ và cập nhật tồn kho."
            : "Đã xác nhận chốt biên bản kiểm kê."
        )
      } else {
        toast.error(result.message)
        setReviewed(false)
        const latest = await getStocktakeAction(session.id)
        if (latest.success) receive(latest.data)
      }
    })
  }

  const visibleItems =
    session?.items.filter(
      (item) =>
        resultFilter === "all" ||
        (resultFilter === "shortage"
          ? (item.shortage_quantity ?? Math.max(0, -item.difference)) > 0
          : resultFilter === "surplus"
            ? (item.surplus_quantity ?? Math.max(0, item.difference)) > 0
            : item.result === resultFilter)
    ) ?? []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Mặt hàng / biến thể", value: stockLines.length },
          {
            label: "Tổng đơn vị tồn",
            value: stockLines.reduce((sum, stock) => sum + stock, 0),
          },
          {
            label: "Sắp hết (1–5)",
            value: stockLines.filter((stock) => stock > 0 && stock <= 5).length,
          },
          {
            label: "Hết hàng",
            value: stockLines.filter((stock) => stock === 0).length,
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {stat.value.toLocaleString("vi-VN")}
            </p>
          </div>
        ))}
      </div>
      <ShopInventoryUnitsPanel key={inventoryRevision} products={products} />
      <Card>
        <CardHeader>
          <CardTitle>Kiểm kê theo từng đơn vị hàng</CardTitle>
          <CardDescription>
            Mỗi đơn vị có SKU và tem QR riêng. Tồn 2 tương ứng 2 tem khác nhau;
            quét lặp lại một tem chỉ ghi nhận một lần.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                setCamera(false)
                run(async () => {
                  const result = await createStocktakeAction(sessionName)
                  if (result.success) {
                    receive(result.data, true)
                    setLastScan("")
                    setCode("")
                    setResultFilter("all")
                  } else toast.error(result.message)
                })
              }}
            >
              <div className="min-w-40 flex-1 space-y-1">
                <Label htmlFor="stocktake-name">Tên phiên mới</Label>
                <Input
                  id="stocktake-name"
                  value={sessionName}
                  maxLength={120}
                  required
                  disabled={actionsDisabled}
                  onChange={(event) => setSessionName(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={actionsDisabled || !products.length}
              >
                Bắt đầu kiểm kê
              </Button>
            </form>
            <div className="space-y-1">
              <Label htmlFor="stocktake-history">
                Mở phiên đã lưu (30 phiên gần nhất)
              </Label>
              <AppSelect
                id="stocktake-history"
                placeholder="Chọn phiên kiểm kê"
                value={session?.id ?? ""}
                disabled={actionsDisabled}
                options={history.map((item) => ({
                  value: item.id,
                  label: `${item.name} · ${item.status === "counting" ? "Đang kiểm" : "Đã chốt"}`,
                }))}
                onValueChange={(id) => {
                  if (!id) return
                  setCamera(false)
                  run(async () => {
                    const result = await getStocktakeAction(id)
                    if (result.success) {
                      receive(result.data, true)
                      setLastScan("")
                      setCode("")
                      setResultFilter("all")
                    } else toast.error(result.message)
                  })
                }}
              />
            </div>
          </div>
          {historyError && (
            <p role="alert" className="text-sm text-destructive">
              {historyError}
            </p>
          )}
          {session && (
            <div className="space-y-5 border-t pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {session.name}{" "}
                    <Badge variant="outline">
                      {session.status === "counting"
                        ? "Đang kiểm kê"
                        : session.stock_adjusted
                          ? "Đã chốt và cập nhật tồn"
                          : "Đã chốt biên bản"}
                    </Badge>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mốc tồn: {formatDate(session.created_at)}
                    {session.saved_at
                      ? ` · Lưu gần nhất: ${formatDate(session.saved_at)}`
                      : ""}
                  </p>
                  {session.confirmed_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Xác nhận chốt: {formatDate(session.confirmed_at)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionsDisabled}
                    onClick={() => {
                      setCamera(false)
                      run(async () => {
                        const result = await getStocktakeAction(session.id)
                        if (result.success) receive(result.data, true)
                        else toast.error(result.message)
                      })
                    }}
                  >
                    <RefreshCwIcon /> Tải lại
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionsDisabled}
                    onClick={exportSession}
                  >
                    <DownloadIcon /> Xuất biên bản CSV
                  </Button>
                </div>
              </div>
              {!serialized && (
                <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                  Phiên cũ ghi nhận số lượng gộp và không có công nợ theo mã
                  riêng. Mở phiên mới để kiểm kê từng đơn vị; dữ liệu lịch sử
                  được giữ nguyên.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                {[
                  { label: "Tồn đầu phiên", count: session.summary.expected },
                  { label: "Đã kiểm", count: session.summary.counted },
                  { label: "Thiếu mã", count: session.summary.shortage },
                  { label: "Thừa mã", count: session.summary.surplus },
                  {
                    label: "Mã không thuộc kho",
                    count: session.summary.unknown,
                  },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {stat.count.toLocaleString("vi-VN")}
                    </p>
                  </div>
                ))}
              </div>
              {finance && (
                <div className="space-y-3 rounded-xl border p-4">
                  <div>
                    <p className="font-medium">
                      {session.status === "completed"
                        ? "Công nợ đã xác nhận trong biên bản"
                        : "Dự tính công nợ theo giá bán hiện tại"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Công nợ thiếu hàng = tổng giá bán của các đơn vị bị thiếu.
                      Hàng thừa theo dõi riêng, không tự bù trừ. Mã lạ không
                      được định giá.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        label: "Công nợ thiếu hàng cần đối soát",
                        value: finance.debt_amount,
                      },
                      {
                        label: "Giá trị hàng thừa",
                        value: finance.surplus_value,
                      },
                      {
                        label: "Chênh lệch ròng (thừa − thiếu)",
                        value: finance.net_difference_value,
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg bg-muted/50 p-3"
                      >
                        <p className="text-xs text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {formatCurrency(stat.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Giá trị tồn đầu phiên{" "}
                    {formatCurrency(finance.expected_value)} · Giá trị đã kiểm{" "}
                    {formatCurrency(finance.counted_value)}. Đơn giá và kết quả
                    được cố định khi chốt.
                  </p>
                </div>
              )}
              {serialized && session.status === "counting" && (
                <div className="space-y-3 rounded-lg border p-4">
                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(event) => {
                      event.preventDefault()
                      scan(scanInput.current?.value ?? "")
                    }}
                  >
                    <div className="min-w-40 flex-1 space-y-1">
                      <Label htmlFor="stocktake-code">
                        Quét QR hoặc nhập SKU riêng trên tem
                      </Label>
                      <Input
                        ref={scanInput}
                        id="stocktake-code"
                        name="code"
                        value={code}
                        maxLength={255}
                        autoComplete="off"
                        placeholder="Đặt con trỏ ở đây rồi bắn mã"
                        disabled={scanDisabled}
                        autoCapitalize="characters"
                        spellCheck={false}
                        onChange={(event) => setCode(event.target.value)}
                        onKeyDown={(event) => {
                          if (
                            !event.nativeEvent.isComposing &&
                            (event.key === "Enter" ||
                              (event.key === "Tab" &&
                                !event.shiftKey &&
                                Boolean(event.currentTarget.value.trim())))
                          ) {
                            event.preventDefault()
                            scan(event.currentTarget.value)
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={scanDisabled || !code.trim()}
                    >
                      {queueState.running
                        ? "Thêm mã vào hàng đợi"
                        : "Ghi nhận 1 đơn vị"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={scanDisabled}
                      onClick={() => setCamera(!camera)}
                    >
                      <CameraIcon />
                      {camera ? "Tắt camera" : "Quét bằng camera"}
                    </Button>
                  </form>
                  {camera && (
                    <InventoryQrScanner
                      onScan={scan}
                      onError={(message) => {
                        setCamera(false)
                        toast.error(message)
                      }}
                    />
                  )}
                  {queueState.queued > 0 && (
                    <div
                      className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm"
                      aria-live="polite"
                    >
                      <p>
                        {queueState.running
                          ? `Đang ghi nhận ${queueState.queued} mã. Có thể tiếp tục bắn mã vào ô SKU.`
                          : `Còn ${queueState.queued} mã chưa được xác nhận.`}
                      </p>
                      {queueState.error && (
                        <>
                          <p
                            className="break-all text-destructive"
                            role="alert"
                          >
                            {queueState.nextCode}: {queueState.error}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={pending}
                              onClick={drainScans}
                            >
                              Thử lại các mã đang chờ
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() => {
                                const skipped = scanQueue.current.skipFailed()
                                setQueueState(scanQueue.current.snapshot())
                                if (skipped)
                                  toast.info(
                                    `Đã bỏ mã ${skipped.code} khỏi hàng đợi. Tải lại phiên để kiểm tra trạng thái đã ghi nhận.`
                                  )
                                if (scanQueue.current.snapshot().queued)
                                  drainScans()
                                else scanInput.current?.focus()
                              }}
                            >
                              Bỏ qua mã lỗi này
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Máy quét có thể gửi Enter hoặc Tab sau mỗi SKU. Có thể bắn
                    liên tiếp; hệ thống xử lý lần lượt. Tem QR mới chỉ chứa SKU
                    riêng của đơn vị, tem DH:U đã in trước đây vẫn dùng được. Mở
                    chi tiết bên dưới để xem mã thiếu, thừa hoặc hoàn tác tem
                    quét nhầm.
                  </p>
                  <p role="status" aria-live="polite" className="text-sm">
                    {lastScan}
                  </p>
                </div>
              )}
              <div className="flex max-w-sm items-center gap-3">
                <Label htmlFor="stocktake-result" className="shrink-0">
                  Đối chiếu
                </Label>
                <AppSelect
                  id="stocktake-result"
                  value={resultFilter}
                  options={resultOptions}
                  onValueChange={setResultFilter}
                />
              </div>
              <div className="max-h-[38rem] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mặt hàng / mã đơn vị</TableHead>
                      <TableHead className="text-right">Tồn đầu</TableHead>
                      <TableHead className="text-right">Đã kiểm</TableHead>
                      <TableHead className="text-right">
                        Giá bán / đơn vị
                      </TableHead>
                      <TableHead>Kết quả</TableHead>
                      <TableHead className="text-right">
                        Tiền thiếu / thừa
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="min-w-60 align-top">
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.variant_name || "Sản phẩm tiêu chuẩn"} ·{" "}
                            {item.sku || item.code}
                          </p>
                          {Boolean(item.units?.length) && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-medium text-primary">
                                Xem {item.units_total ?? item.units!.length} mã
                                đơn vị
                              </summary>
                              <StocktakeUnitList
                                stocktakeId={session.id}
                                item={item}
                                editable={session.status === "counting"}
                                disabled={actionsDisabled}
                                revision={
                                  session.confirmation_token ??
                                  session.completed_at ??
                                  undefined
                                }
                                onUndo={(unitId) =>
                                  run(async () => {
                                    const result =
                                      await undoStocktakeUnitAction(
                                        session.id,
                                        unitId
                                      )
                                    if (result.success) {
                                      receive(result.data, true)
                                      toast.success(
                                        "Đã bỏ ghi nhận tem; quét lại nếu tìm thấy."
                                      )
                                    } else toast.error(result.message)
                                  })
                                }
                              />
                            </details>
                          )}
                        </TableCell>
                        <TableCell className="text-right align-top tabular-nums">
                          {item.expected_quantity}
                        </TableCell>
                        <TableCell className="text-right align-top tabular-nums">
                          {item.counted_quantity}
                        </TableCell>
                        <TableCell className="text-right align-top whitespace-nowrap">
                          {item.unit_price == null
                            ? "—"
                            : formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="align-top">
                          <ItemResult item={item} />
                        </TableCell>
                        <TableCell className="text-right align-top whitespace-nowrap">
                          {item.values ? (
                            <div>
                              <p>
                                Thiếu{" "}
                                {formatCurrency(item.values.shortage_value)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Thừa {formatCurrency(item.values.surplus_value)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Không tính tiền
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!visibleItems.length && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-6 text-center text-muted-foreground"
                        >
                          Không có mặt hàng phù hợp.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {session.status === "counting" && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-xl text-xs text-muted-foreground">
                    Lưu phiên để kiểm tiếp. Chốt phiên cần xác nhận toàn bộ số
                    lượng và giá trị chênh lệch; phiên đã chốt không thể sửa.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={actionsDisabled}
                      onClick={save}
                    >
                      <SaveIcon /> Lưu phiên
                    </Button>
                    <Button
                      disabled={actionsDisabled}
                      onClick={openConfirmation}
                    >
                      Kiểm tra và chốt phiên
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog
        open={completeOpen}
        onOpenChange={(open) => {
          if (!pending) {
            setCompleteOpen(open)
            if (!open) setReviewed(false)
          }
        }}
      >
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Xác nhận số lượng và công nợ kiểm kê
            </AlertDialogTitle>
            <AlertDialogDescription>
              Thiếu {session?.summary.shortage ?? 0} mã, thừa{" "}
              {session?.summary.surplus ?? 0} mã, không thuộc kho{" "}
              {session?.summary.unknown ?? 0} mã. Mã chưa kiểm được tính là
              thiếu. Phiên đã chốt không thể sửa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {finance && (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span>Công nợ thiếu hàng</span>
                <strong>{formatCurrency(finance.debt_amount)}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>Giá trị hàng thừa</span>
                <span>{formatCurrency(finance.surplus_value)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tính theo giá bán hiện tại. Tiền thừa không tự bù trừ công nợ
                thiếu hàng. Đơn giá được giữ cố định sau khi chốt.
              </p>
            </div>
          )}
          <div className="flex items-start gap-3">
            <Checkbox
              id="stocktake-confirm-reviewed"
              checked={reviewed}
              disabled={actionsDisabled}
              onCheckedChange={(value) => setReviewed(value === true)}
            />
            <Label
              htmlFor="stocktake-confirm-reviewed"
              className="text-sm leading-5"
            >
              Tôi đã đối chiếu từng mã, xác nhận số lượng thiếu/thừa và giá trị
              công nợ hiển thị.
            </Label>
          </div>
          <AlertDialogFooter className="flex-wrap">
            <Button
              variant="outline"
              disabled={actionsDisabled}
              onClick={() => setCompleteOpen(false)}
            >
              Kiểm tra lại
            </Button>
            <Button
              variant="secondary"
              disabled={actionsDisabled || !reviewed}
              onClick={() => complete(false)}
            >
              Chốt biên bản, giữ tồn
            </Button>
            <Button
              disabled={actionsDisabled || !reviewed}
              onClick={() => complete(true)}
            >
              Chốt và cập nhật tồn
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
