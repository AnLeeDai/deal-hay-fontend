"use client"

import { useEffect, useId, useState } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  PrinterIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
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
import { formatCurrency } from "@/lib/format"
import { listInventoryUnitsAction } from "@/modules/shop-management/inventory-unit-actions"
import {
  inventoryLabels,
  printInventoryLabels,
} from "@/modules/shop-management/lib/inventory-labels"
import type { InventoryUnit, InventoryUnitPage } from "@/types/inventory-unit"
import type { ShopProduct } from "@/types/shop"

const MAX_PRINT_UNITS = 1000

export function ShopInventoryUnitsPanel({
  products = [],
}: {
  products?: ShopProduct[]
}) {
  const prefix = useId()
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState({
    search: "",
    productId: "all",
    page: 1,
    revision: 0,
  })
  const [result, setResult] = useState<{
    key: string
    data?: InventoryUnitPage
    error?: string
  } | null>(null)
  const [selected, setSelected] = useState(new Map<string, InventoryUnit>())
  const [printing, setPrinting] = useState(false)
  const requestKey = JSON.stringify(filters)
  const waitingForSearch = search.trim() !== filters.search
  const loading = result?.key !== requestKey || waitingForSearch
  const page = result?.key === requestKey ? result.data : undefined
  const error = !loading ? result?.error : undefined
  const rows = page?.data ?? []
  const allSelected =
    rows.length > 0 && rows.every(({ id }) => selected.has(id))
  const someSelected = rows.some(({ id }) => selected.has(id))
  const additionalOnPage = rows.filter(({ id }) => !selected.has(id)).length

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((previous) =>
        previous.search === search.trim()
          ? previous
          : { ...previous, search: search.trim(), page: 1 }
      )
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    listInventoryUnitsAction({
      page: filters.page,
      per_page: 100,
      search: filters.search || undefined,
      product_id: filters.productId === "all" ? undefined : filters.productId,
    })
      .then((response) => {
        if (!active) return
        if (!response.success) {
          setResult({ key: requestKey, error: response.message })
          return
        }
        const lastPage = Math.max(1, response.data.meta.last_page)
        if (filters.page > lastPage) {
          setFilters((previous) => ({ ...previous, page: lastPage }))
          return
        }
        setResult({ key: requestKey, data: response.data })
        setSelected((previous) => {
          const next = new Map(previous)
          for (const unit of response.data.data) {
            if (next.has(unit.id)) next.set(unit.id, unit)
          }
          return next
        })
      })
      .catch(() => {
        if (active)
          setResult({
            key: requestKey,
            error: "Kết nối bị gián đoạn. Vui lòng tải lại danh sách.",
          })
      })
    return () => {
      active = false
    }
  }, [filters, requestKey])

  function toggle(unit: InventoryUnit, checked: boolean) {
    setSelected((previous) => {
      const next = new Map(previous)
      if (checked) {
        if (next.size >= MAX_PRINT_UNITS && !next.has(unit.id)) return previous
        next.set(unit.id, unit)
      } else next.delete(unit.id)
      return next
    })
  }

  function togglePage(checked: boolean) {
    setSelected((previous) => {
      const next = new Map(previous)
      if (
        checked &&
        next.size + rows.filter(({ id }) => !next.has(id)).length >
          MAX_PRINT_UNITS
      )
        return previous
      for (const unit of rows) {
        if (checked) next.set(unit.id, unit)
        else next.delete(unit.id)
      }
      return next
    })
  }

  async function printSelected() {
    if (printing || !selected.size) return
    setPrinting(true)
    try {
      await printInventoryLabels(inventoryLabels([...selected.values()]))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể tạo tem QR. Vui lòng thử lại."
      )
    } finally {
      setPrinting(false)
    }
  }

  function reload() {
    setFilters((previous) => ({ ...previous, revision: previous.revision + 1 }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tem riêng từng đơn vị hàng hóa</CardTitle>
        <CardDescription>
          Mỗi dòng là một đơn vị trong kho, có SKU và mã QR riêng. Mỗi đơn vị
          được in một tem trong một lần in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-search`}>Tìm đơn vị hàng hóa</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                id={`${prefix}-search`}
                className="pl-9"
                placeholder="Tên sản phẩm hoặc SKU trên tem"
                value={search}
                maxLength={200}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-product`}>Sản phẩm</Label>
            <AppSelect
              id={`${prefix}-product`}
              value={filters.productId}
              onValueChange={(productId) =>
                setFilters((previous) => ({ ...previous, productId, page: 1 }))
              }
              options={[
                { value: "all", label: "Tất cả sản phẩm" },
                ...products.map((product) => ({
                  value: product.id,
                  label: product.name,
                })),
              ]}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={reload}
            disabled={loading}
            aria-label="Tải lại danh sách đơn vị hàng hóa"
          >
            <RefreshCwIcon /> Tải lại
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
          <div className="space-y-1">
            <p className="text-sm font-medium" aria-live="polite">
              Đã chọn {selected.size}/{MAX_PRINT_UNITS} đơn vị
            </p>
            <p className="text-xs text-muted-foreground">
              Lựa chọn được giữ khi đổi trang hoặc bộ lọc.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!selected.size || printing}
              onClick={() => setSelected(new Map())}
            >
              Bỏ chọn tất cả
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selected.size || printing}
              onClick={() => {
                void printSelected()
              }}
            >
              {printing ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <PrinterIcon />
              )}{" "}
              {printing ? "Đang tạo tem..." : `In ${selected.size} tem đã chọn`}
            </Button>
          </div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          In lại sử dụng đúng SKU và QR đã cấp của đơn vị đó. Thao tác in không
          tạo thêm hàng hoặc mã mới. Mã QR chỉ chứa SKU được in trên tem.
        </p>
        {loading ? (
          <p
            className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircleIcon className="size-4 animate-spin" /> Đang tải đơn vị
            hàng hóa...
          </p>
        ) : error ? (
          <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={reload}>
              Thử lại
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {filters.search || filters.productId !== "all"
              ? "Không tìm thấy đơn vị hàng hóa phù hợp. Thử đổi từ khóa hoặc sản phẩm."
              : "Chưa có đơn vị hàng hóa sẵn có trong kho để in tem."}
          </div>
        ) : (
          <div className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      aria-label="Chọn tất cả đơn vị trên trang này"
                      checked={allSelected}
                      indeterminate={someSelected && !allSelected}
                      disabled={
                        printing ||
                        (!allSelected &&
                          selected.size + additionalOnPage > MAX_PRINT_UNITS)
                      }
                      onCheckedChange={togglePage}
                    />
                  </TableHead>
                  <TableHead>Sản phẩm / biến thể</TableHead>
                  <TableHead>SKU đơn vị / nội dung QR</TableHead>
                  <TableHead className="text-right">Giá bán hiện tại</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((unit) => (
                  <TableRow
                    key={unit.id}
                    data-state={selected.has(unit.id) ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        aria-label={`Chọn đơn vị ${unit.sku}`}
                        checked={selected.has(unit.id)}
                        disabled={
                          printing ||
                          (selected.size >= MAX_PRINT_UNITS &&
                            !selected.has(unit.id))
                        }
                        onCheckedChange={(checked) => toggle(unit, checked)}
                      />
                    </TableCell>
                    <TableCell className="min-w-48 whitespace-normal">
                      <p className="font-medium">{unit.product_name}</p>
                      {unit.variant_name ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {unit.variant_name}
                        </p>
                      ) : null}
                      {!unit.is_active ? (
                        <Badge variant="outline" className="mt-1">
                          Đang ẩn
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="min-w-64 whitespace-normal">
                      <code className="text-xs break-all">{unit.sku}</code>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(unit.price)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Trong kho</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <p className="text-sm text-muted-foreground">
                Trang {page?.meta.current_page ?? filters.page}/
                {page?.meta.last_page ?? 1} · {page?.meta.total ?? 0} đơn vị
                trong kết quả
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={(page?.meta.current_page ?? 1) <= 1}
                  onClick={() =>
                    setFilters((previous) => ({
                      ...previous,
                      page: previous.page - 1,
                    }))
                  }
                >
                  <ChevronLeftIcon /> Trước
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    (page?.meta.current_page ?? 1) >=
                    (page?.meta.last_page ?? 1)
                  }
                  onClick={() =>
                    setFilters((previous) => ({
                      ...previous,
                      page: previous.page + 1,
                    }))
                  }
                >
                  Sau <ChevronRightIcon />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
