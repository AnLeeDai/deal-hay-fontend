"use client"

import { useEffect, useState } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  listStocktakeUnitsAction,
  type StocktakeUnitPage,
} from "@/modules/shop-management/inventory-unit-detail-actions"
import type { StocktakeItem, StocktakeUnit } from "@/types/inventory"

const PAGE_SIZE = 100

function unitStatus(unit: StocktakeUnit): string {
  if (unit.expected)
    return unit.counted ? "Đã kiểm đúng mã" : "Chưa tìm thấy — thiếu"
  return unit.counted ? "Tìm thấy ngoài tồn đầu phiên — thừa" : "Đã bỏ ghi nhận"
}

export function StocktakeUnitList({
  stocktakeId,
  item,
  editable,
  disabled,
  onUndo,
  revision,
}: {
  stocktakeId: string
  item: StocktakeItem
  editable: boolean
  disabled: boolean
  onUndo: (entryId: string) => void
  revision?: string
}) {
  const identity = `${stocktakeId}:${item.id}:${revision ?? `${item.counted_quantity}:${item.expected_quantity}:${item.units_total ?? item.units?.length ?? 0}`}`
  const [navigation, setNavigation] = useState({
    identity: "",
    page: 1,
    retry: 0,
  })
  const [loaded, setLoaded] = useState<{
    key: string
    data?: StocktakeUnitPage
    error?: string
  } | null>(null)
  const page = navigation.identity === identity ? navigation.page : 1
  const retry = navigation.identity === identity ? navigation.retry : 0
  const useInitialPage = page === 1 && retry === 0
  const requestKey = `${identity}:${page}:${retry}`
  const matchingResponse = loaded?.key === requestKey ? loaded : undefined
  const initialRows = (item.units ?? []).slice(0, PAGE_SIZE)
  const initialTotal = item.units_total ?? item.units?.length ?? 0
  const meta = matchingResponse?.data?.meta ?? {
    current_page: page,
    last_page: Math.max(1, Math.ceil(initialTotal / PAGE_SIZE)),
    total: initialTotal,
    per_page: PAGE_SIZE,
  }
  const rows = useInitialPage
    ? initialRows
    : (matchingResponse?.data?.data ?? [])
  const loading = !useInitialPage && !matchingResponse
  const error = useInitialPage ? undefined : matchingResponse?.error

  useEffect(() => {
    if (useInitialPage) return
    let active = true
    listStocktakeUnitsAction(stocktakeId, item.id, page, PAGE_SIZE)
      .then((response) => {
        if (!active) return
        if (!response.success) {
          setLoaded({ key: requestKey, error: response.message })
          return
        }
        const lastPage = Math.max(1, response.data.meta.last_page)
        if (page > lastPage) {
          setNavigation({ identity, page: lastPage, retry: retry + 1 })
          return
        }
        setLoaded({ key: requestKey, data: response.data })
      })
      .catch(() => {
        if (active)
          setLoaded({
            key: requestKey,
            error: "Kết nối bị gián đoạn. Vui lòng tải lại các mã đơn vị.",
          })
      })
    return () => {
      active = false
    }
  }, [identity, item.id, page, requestKey, retry, stocktakeId, useInitialPage])

  return (
    <div className="mt-2 space-y-3 whitespace-normal">
      {loading ? (
        <p
          role="status"
          className="flex items-center gap-2 py-3 text-xs text-muted-foreground"
        >
          <LoaderCircleIcon className="size-3.5 animate-spin" /> Đang tải mã đơn
          vị...
        </p>
      ) : error ? (
        <div className="space-y-2 rounded-md border border-destructive/30 p-3">
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={disabled}
            onClick={() => setNavigation({ identity, page, retry: retry + 1 })}
          >
            Thử lại
          </Button>
        </div>
      ) : rows.length ? (
        <ul className="max-h-64 space-y-2 overflow-auto">
          {rows.map((unit) => (
            <li
              key={unit.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs break-all">{unit.sku}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {unitStatus(unit)}
                </p>
              </div>
              {editable && unit.counted ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  aria-label={`Hoàn tác ghi nhận ${unit.sku}`}
                  disabled={disabled}
                  onClick={() => onUndo(unit.id)}
                >
                  Hoàn tác
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-xs text-muted-foreground">
          Chưa có mã đơn vị trong mặt hàng này.
        </p>
      )}
      {meta.last_page > 1 || page > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-xs text-muted-foreground">
            Trang {meta.current_page}/{meta.last_page} · {meta.total} mã
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={disabled || loading || page <= 1}
              onClick={() =>
                setNavigation({ identity, page: page - 1, retry: 0 })
              }
            >
              <ChevronLeftIcon /> Trước
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={disabled || loading || page >= meta.last_page}
              onClick={() =>
                setNavigation({ identity, page: page + 1, retry: 0 })
              }
            >
              Sau <ChevronRightIcon />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
