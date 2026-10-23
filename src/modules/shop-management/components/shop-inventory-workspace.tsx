"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  CameraIcon,
  DownloadIcon,
  PrinterIcon,
  QrCodeIcon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  scanStocktakeAction,
  updateStocktakeItemAction,
} from "@/modules/shop-management/inventory-actions"
import {
  inventoryLabels,
  printInventoryLabels,
} from "@/modules/shop-management/lib/inventory-labels"
import { InventoryQrScanner } from "@/modules/shop-management/components/inventory-qr-scanner"

const resultLabels: Record<StocktakeItem["result"], string> = {
  matched: "Đủ",
  shortage: "Thiếu",
  surplus: "Thừa",
  unknown: "Không thuộc kho",
}

function exportReport(session: Stocktake) {
  const cell = (value: string | number | null) => {
    let text = String(value ?? "")
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const rows = [
    [
      "Sản phẩm",
      "Biến thể",
      "SKU / mã",
      "Tồn đầu phiên",
      "Thực đếm",
      "Chênh lệch",
      "Kết quả",
    ],
    ...session.items.map((item) => [
      item.product_name,
      item.variant_name,
      item.sku || item.code,
      item.expected_quantity,
      item.counted_quantity,
      item.difference,
      resultLabels[item.result],
    ]),
  ]
  const url = URL.createObjectURL(
    new Blob(
      ["\ufeff", rows.map((row) => row.map(cell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" }
    )
  )
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `kiem-ke-${session.id}.csv`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ShopInventoryWorkspace({
  products,
}: {
  products: ShopProduct[]
}) {
  const labels = useMemo(() => inventoryLabels(products), [products])
  const [query, setQuery] = useState("")
  const [stockFilter, setStockFilter] = useState("all")
  const [selected, setSelected] = useState<string[]>([])
  const [copies, setCopies] = useState(1)
  const [printing, setPrinting] = useState(false)
  const [page, setPage] = useState(1)
  const filtered = labels.filter(
    (item) =>
      `${item.name} ${item.variant} ${item.sku}`
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")) &&
      (stockFilter === "all" ||
        (stockFilter === "empty"
          ? item.stock === 0
          : item.stock > 0 && item.stock <= 5))
  )
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / 50))
  )
  const visible = filtered.slice((currentPage - 1) * 50, currentPage * 50)

  const [history, setHistory] = useState<StocktakeSummary[]>([])
  const [historyError, setHistoryError] = useState("")
  const [session, setSession] = useState<Stocktake | null>(null)
  const [sessionName, setSessionName] = useState(
    () =>
      `Kiểm kê ${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Bangkok" }).format(new Date())}`
  )
  const [code, setCode] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [camera, setCamera] = useState(false)
  const [resultFilter, setResultFilter] = useState("all")
  const [completeOpen, setCompleteOpen] = useState(false)
  const [lastScan, setLastScan] = useState("")
  const [pending, startTransition] = useTransition()
  const scanInput = useRef<HTMLInputElement>(null)
  const scanRetry = useRef<{
    sessionId: string
    code: string
    quantity: number
    id: string
  } | null>(null)
  const scanBusy = useRef(false)
  const focusAfterScan = useRef(false)

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
            "Không tải được danh sách phiên kiểm kê. Vui lòng tải lại trang."
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

  function receive(next: Stocktake) {
    setSession(next)
    setHistory((previous) =>
      [next, ...previous.filter((item) => item.id !== next.id)].slice(0, 30)
    )
  }

  function scan(scannedCode: string) {
    if (
      !session ||
      session.status !== "counting" ||
      scanBusy.current ||
      pending
    )
      return
    const normalized = scannedCode.trim()
    if (
      !normalized ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 999999
    ) {
      toast.error("Nhập mã và số lượng từ 1–999999.")
      return
    }
    setCamera(false)
    setCode(normalized)
    scanBusy.current = true
    const previous = scanRetry.current
    const scanId =
      previous &&
      previous.sessionId === session.id &&
      previous.code === normalized &&
      previous.quantity === quantity
        ? previous.id
        : crypto.randomUUID()
    scanRetry.current = {
      sessionId: session.id,
      code: normalized,
      quantity,
      id: scanId,
    }
    run(async () => {
      try {
        const result = await scanStocktakeAction(
          session.id,
          normalized,
          quantity,
          scanId
        )
        if (result.success) {
          receive(result.data)
          scanRetry.current = null
          setCode("")
          const item = result.data.items.find(
            (item) =>
              item.code === normalized || item.sku === normalized.toUpperCase()
          )
          setLastScan(
            item
              ? `${item.product_name}${item.variant_name ? ` / ${item.variant_name}` : ""}: thực đếm ${item.counted_quantity}, tồn đầu phiên ${item.expected_quantity} — ${resultLabels[item.result]}`
              : "Đã ghi nhận lượt quét."
          )
          if (item?.is_unknown)
            toast.warning(
              "Mã không thuộc danh sách kiểm kê; đã ghi nhận riêng."
            )
        } else toast.error(result.message)
      } finally {
        scanBusy.current = false
        focusAfterScan.current = true
      }
    })
  }

  function updateCount(item: StocktakeItem, input: HTMLInputElement) {
    if (!session || pending) return
    const count = Number(input.value)
    if (
      !input.value ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > 999999
    ) {
      input.value = String(item.counted_quantity)
      toast.error("Số thực đếm phải từ 0–999999.")
      return
    }
    if (count === item.counted_quantity) return
    run(async () => {
      try {
        const result = await updateStocktakeItemAction(
          session.id,
          item.id,
          count
        )
        if (result.success) receive(result.data)
        else {
          input.value = String(item.counted_quantity)
          toast.error(result.message)
        }
      } catch (error) {
        input.value = String(item.counted_quantity)
        throw error
      }
    })
  }

  function complete(adjustStock: boolean) {
    if (!session) return
    setCamera(false)
    run(async () => {
      const result = await completeStocktakeAction(session.id, adjustStock)
      if (result.success) {
        receive(result.data)
        setCompleteOpen(false)
        toast.success(
          adjustStock
            ? "Đã chốt kiểm kê và cập nhật tồn kho."
            : "Đã lưu biên bản kiểm kê."
        )
      } else toast.error(result.message)
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Mặt hàng / biến thể", value: labels.length },
          {
            label: "Tổng số lượng",
            value: labels.reduce((sum, item) => sum + item.stock, 0),
          },
          {
            label: "Sắp hết (1–5)",
            value: labels.filter((item) => item.stock > 0 && item.stock <= 5)
              .length,
          },
          {
            label: "Đã hết hàng",
            value: labels.filter((item) => item.stock === 0).length,
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCodeIcon className="size-5" /> Danh mục kho & tem sản phẩm
          </CardTitle>
          <CardDescription>
            Mỗi sản phẩm hoặc biến thể có mã QR riêng. In tem để dán lên từng
            đơn vị hàng và quét khi kiểm kê.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1 space-y-1">
              <Label htmlFor="inventory-query">Tìm trong kho</Label>
              <Input
                id="inventory-query"
                value={query}
                placeholder="Tên sản phẩm, biến thể hoặc SKU"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inventory-filter">Tình trạng tồn</Label>
              <select
                id="inventory-filter"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={stockFilter}
                onChange={(event) => {
                  setStockFilter(event.target.value)
                  setPage(1)
                }}
              >
                <option value="all">Tất cả</option>
                <option value="low">Sắp hết (1–5)</option>
                <option value="empty">Hết hàng</option>
              </select>
            </div>
            <div className="w-28 space-y-1">
              <Label htmlFor="label-copies">Tem / mặt hàng</Label>
              <Input
                id="label-copies"
                type="number"
                min={1}
                max={100}
                value={copies}
                onChange={(event) => setCopies(Number(event.target.value))}
              />
            </div>
            <Button
              variant="outline"
              disabled={printing || !selected.length}
              onClick={async () => {
                setPrinting(true)
                try {
                  await printInventoryLabels(
                    labels.filter((item) => selected.includes(item.id)),
                    copies
                  )
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Không tạo được tem QR."
                  )
                } finally {
                  setPrinting(false)
                }
              }}
            >
              <PrinterIcon />
              {printing ? "Đang tạo tem…" : `In tem (${selected.length})`}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả kết quả lọc"
                      checked={
                        filtered.length > 0 &&
                        filtered.every((item) => selected.includes(item.id))
                      }
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? Array.from(
                                new Set([
                                  ...selected,
                                  ...filtered.map((item) => item.id),
                                ])
                              )
                            : selected.filter(
                                (id) => !filtered.some((item) => item.id === id)
                              )
                        )
                      }
                    />
                  </th>
                  <th className="p-3">Sản phẩm / biến thể</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3 text-right">Tồn kho</th>
                  <th className="p-3 text-right">Giá bán</th>
                  <th className="p-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`Chọn in tem ${item.name} ${item.variant}`}
                        checked={selected.includes(item.id)}
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? [...selected, item.id]
                              : selected.filter((id) => id !== item.id)
                          )
                        }
                      />
                    </td>
                    <td className="min-w-48 p-3">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.variant || "Sản phẩm tiêu chuẩn"}
                      </p>
                    </td>
                    <td className="p-3 font-mono text-xs">{item.sku || "—"}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">
                      {item.stock}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="p-3">
                      <Badge variant={item.active ? "secondary" : "outline"}>
                        {item.active ? "Đang bán" : "Đang ẩn"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-6 text-center text-muted-foreground"
                    >
                      Không có mặt hàng phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 50 && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>
                {filtered.length} mặt hàng · Trang {currentPage}/
                {Math.ceil(filtered.length / 50)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage * 50 >= filtered.length}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kiểm kê hàng hóa</CardTitle>
          <CardDescription>
            Mỗi lần quét cộng vào số thực đếm. Bảng đối chiếu tự cập nhật; mã lạ
            được ghi riêng. Hàng chưa đếm có số thực đếm bằng 0.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                run(async () => {
                  const result = await createStocktakeAction(sessionName)
                  if (result.success) {
                    receive(result.data)
                    setLastScan("")
                    setResultFilter("all")
                    setCamera(false)
                  } else toast.error(result.message)
                })
              }}
            >
              <div className="flex-1 space-y-1">
                <Label htmlFor="stocktake-name">Tên phiên mới</Label>
                <Input
                  id="stocktake-name"
                  value={sessionName}
                  maxLength={120}
                  required
                  onChange={(event) => setSessionName(event.target.value)}
                />
              </div>
              <Button disabled={pending || !labels.length} type="submit">
                Bắt đầu kiểm kê
              </Button>
            </form>
            <div className="space-y-1">
              <Label htmlFor="stocktake-history">
                Mở phiên đã lưu (30 phiên gần nhất)
              </Label>
              <select
                id="stocktake-history"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={session?.id ?? ""}
                disabled={pending}
                onChange={(event) => {
                  const id = event.target.value
                  if (!id) return
                  setCamera(false)
                  run(async () => {
                    const result = await getStocktakeAction(id)
                    if (result.success) {
                      receive(result.data)
                      setLastScan("")
                      setResultFilter("all")
                    } else toast.error(result.message)
                  })
                }}
              >
                <option value="">Chọn phiên kiểm kê</option>
                {history.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ·{" "}
                    {item.status === "counting" ? "Đang đếm" : "Đã chốt"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {historyError && (
            <p role="alert" className="text-sm text-destructive">
              {historyError}
            </p>
          )}
          {session && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {session.name}{" "}
                    <Badge variant="outline">
                      {session.status === "counting"
                        ? "Đang đếm"
                        : session.stock_adjusted
                          ? "Đã cập nhật tồn"
                          : "Đã lưu biên bản"}
                    </Badge>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mốc tồn: {formatDate(session.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      setCamera(false)
                      run(async () => {
                        const result = await getStocktakeAction(session.id)
                        if (result.success) receive(result.data)
                        else toast.error(result.message)
                      })
                    }}
                  >
                    <RefreshCwIcon /> Tải lại
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportReport(session)}
                  >
                    <DownloadIcon /> Xuất CSV
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                {[
                  { label: "Tồn đầu phiên", count: session.summary.expected },
                  { label: "Đã đếm", count: session.summary.counted },
                  { label: "Thiếu", count: session.summary.shortage },
                  { label: "Thừa", count: session.summary.surplus },
                  { label: "Không thuộc kho", count: session.summary.unknown },
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
              {session.status === "counting" && (
                <div className="space-y-3 rounded-lg border p-4">
                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(event) => {
                      event.preventDefault()
                      scan(code)
                    }}
                  >
                    <div className="min-w-40 flex-1 space-y-1">
                      <Label htmlFor="stocktake-code">
                        Quét QR bằng máy quét hoặc nhập SKU
                      </Label>
                      <Input
                        ref={scanInput}
                        id="stocktake-code"
                        value={code}
                        maxLength={255}
                        autoComplete="off"
                        placeholder="Đặt con trỏ ở đây rồi bắn mã"
                        disabled={pending}
                        onChange={(event) => setCode(event.target.value)}
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <Label htmlFor="scan-quantity">Số lượng / lượt</Label>
                      <Input
                        id="scan-quantity"
                        type="number"
                        min={1}
                        max={999999}
                        value={quantity}
                        disabled={pending}
                        onChange={(event) =>
                          setQuantity(Number(event.target.value))
                        }
                      />
                    </div>
                    <Button type="submit" disabled={pending || !code.trim()}>
                      {pending ? "Đang ghi nhận…" : "Ghi nhận"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
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
                  <p className="text-xs text-muted-foreground">
                    Máy quét cần gửi Enter sau mã. Quét thêm một đơn vị sẽ cộng
                    thêm một; sửa trực tiếp ô Thực đếm khi cần điều chỉnh.
                  </p>
                  <p role="status" aria-live="polite" className="text-sm">
                    {lastScan}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Label htmlFor="stocktake-result">Đối chiếu</Label>
                <select
                  id="stocktake-result"
                  value={resultFilter}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  onChange={(event) => setResultFilter(event.target.value)}
                >
                  <option value="all">Tất cả</option>
                  {Object.entries(resultLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="max-h-[32rem] overflow-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-3">Mặt hàng</th>
                      <th className="p-3 text-right">Tồn đầu phiên</th>
                      <th className="p-3 text-right">Thực đếm</th>
                      <th className="p-3 text-right">Chênh lệch</th>
                      <th className="p-3">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.items
                      .filter(
                        (item) =>
                          resultFilter === "all" || item.result === resultFilter
                      )
                      .map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="min-w-48 p-3">
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.variant_name} {item.sku || item.code}
                            </p>
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {item.expected_quantity}
                          </td>
                          <td className="p-3 text-right">
                            {session.status === "counting" ? (
                              <Input
                                key={`${item.id}-${item.counted_quantity}`}
                                className="ml-auto w-24 text-right"
                                aria-label={`Thực đếm ${item.product_name} ${item.variant_name ?? item.code}`}
                                type="number"
                                min={0}
                                max={999999}
                                defaultValue={item.counted_quantity}
                                disabled={pending}
                                onBlur={(event) =>
                                  updateCount(item, event.currentTarget)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter")
                                    event.currentTarget.blur()
                                }}
                              />
                            ) : (
                              item.counted_quantity
                            )}
                          </td>
                          <td className="p-3 text-right font-medium tabular-nums">
                            {item.difference > 0 ? "+" : ""}
                            {item.difference}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                item.result === "matched"
                                  ? "secondary"
                                  : "outline"
                              }
                              className={
                                item.result === "shortage" ||
                                item.result === "unknown"
                                  ? "text-destructive"
                                  : ""
                              }
                            >
                              {resultLabels[item.result]}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {session.status === "counting" && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-xl text-xs text-muted-foreground">
                    Quét chỉ ghi số thực đếm. Khi chốt, bạn có thể lưu biên bản
                    hoặc cập nhật tồn kho theo số đã đếm; mã lạ không được tự
                    thêm vào kho.
                  </p>
                  <Button
                    disabled={pending}
                    onClick={() => {
                      setCamera(false)
                      setCompleteOpen(true)
                    }}
                  >
                    Chốt phiên kiểm kê
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog
        open={completeOpen}
        onOpenChange={(open) => {
          if (!pending) setCompleteOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chốt phiên kiểm kê?</AlertDialogTitle>
            <AlertDialogDescription>
              Thiếu {session?.summary.shortage ?? 0}, thừa{" "}
              {session?.summary.surplus ?? 0}, mã không thuộc kho{" "}
              {session?.summary.unknown ?? 0}. Hàng chưa đếm được tính là 0.
              Phiên đã chốt sẽ không thể sửa. Cập nhật tồn chỉ thực hiện khi tồn
              hệ thống chưa thay đổi kể từ lúc mở phiên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setCompleteOpen(false)}
            >
              Kiểm tra lại
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => complete(false)}
            >
              Lưu biên bản
            </Button>
            <Button disabled={pending} onClick={() => complete(true)}>
              Chốt và cập nhật tồn
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
