"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { ExternalLinkIcon, GiftIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { getAuthPageHref } from "@/lib/auth-redirect"
import { formatCurrency } from "@/lib/format"
import {
  checkRewardedTaskAction,
  loadRewardedTaskConfigAction,
  startRewardedTaskAction,
} from "@/modules/public/rewarded-task-actions"
import type { ProductDiscountCode } from "@/types/discount-code"
import type {
  RewardedTaskConfig,
  RewardedTaskSession,
} from "@/types/rewarded-task"

type RewardedTasksProps = {
  active: boolean
  disabled: boolean
  shopCode: string
  productSlug: string
  onCodesConfirmed: (codes: ProductDiscountCode[]) => void
  onUseCodes: (codes: ProductDiscountCode[]) => void
}

export function RewardedTasks(props: RewardedTasksProps) {
  return (
    <ProductRewardedTasks
      key={JSON.stringify([props.shopCode, props.productSlug])}
      {...props}
    />
  )
}

function ProductRewardedTasks({
  active,
  disabled,
  shopCode,
  productSlug,
  onCodesConfirmed,
  onUseCodes,
}: RewardedTasksProps) {
  const [config, setConfig] = useState<RewardedTaskConfig | null>(null)
  const [task, setTask] = useState<RewardedTaskSession | null>(null)
  const [message, setMessage] = useState("")
  const [requiresSignIn, setRequiresSignIn] = useState(false)
  const [configPending, startConfigTransition] = useTransition()
  const [startPending, startTaskTransition] = useTransition()
  const [checkPending, startCheckTransition] = useTransition()
  const generation = useRef(0)
  const checking = useRef<number | null>(null)
  const taskId = useRef<string | null>(null)
  const storageKey = `deal-hay:rewarded-task:${encodeURIComponent(shopCode)}:${encodeURIComponent(productSlug)}`

  const rememberTask = useCallback(
    (id: string | null) => {
      taskId.current = id
      try {
        if (id) sessionStorage.setItem(storageKey, id)
        else sessionStorage.removeItem(storageKey)
      } catch {
        // Task verification also works when the browser disables local storage.
      }
    },
    [storageKey]
  )

  const checkTask = useCallback(
    (id: string) => {
      const requestGeneration = generation.current
      if (checking.current === requestGeneration) return
      checking.current = requestGeneration
      startCheckTransition(async () => {
        try {
          const state = await checkRewardedTaskAction(shopCode, productSlug, id)
          if (requestGeneration !== generation.current) return
          setRequiresSignIn(Boolean(state.requires_sign_in))
          setMessage(state.message)
          if (state.success && state.data) {
            setTask(state.data)
            onCodesConfirmed(state.data.discount_codes)
          } else if (state.reset_task) {
            rememberTask(null)
            setTask(null)
          }
        } finally {
          if (checking.current === requestGeneration) checking.current = null
        }
      })
    },
    [shopCode, productSlug, onCodesConfirmed, rememberTask]
  )

  useEffect(() => {
    if (!active) return
    const requestGeneration = ++generation.current
    startConfigTransition(async () => {
      const state = await loadRewardedTaskConfigAction(shopCode, productSlug)
      if (requestGeneration !== generation.current) return
      setConfig(state.success && state.data ? state.data : null)
      if (!state.success) setMessage(state.message)
      if (state.requires_sign_in) setRequiresSignIn(true)
    })
    if (!taskId.current) {
      try {
        taskId.current = sessionStorage.getItem(storageKey)
      } catch {
        // A task can still be started without browser storage.
      }
    }
    if (taskId.current) checkTask(taskId.current)
    return () => {
      generation.current += 1
    }
  }, [active, shopCode, productSlug, storageKey, checkTask])

  useEffect(() => {
    if (!active) return
    const checkOnReturn = () => {
      if (document.visibilityState === "visible" && taskId.current) {
        checkTask(taskId.current)
      }
    }
    window.addEventListener("focus", checkOnReturn)
    document.addEventListener("visibilitychange", checkOnReturn)
    return () => {
      window.removeEventListener("focus", checkOnReturn)
      document.removeEventListener("visibilitychange", checkOnReturn)
    }
  }, [active, checkTask])

  function startTask() {
    const requestGeneration = generation.current
    startTaskTransition(async () => {
      const state = await startRewardedTaskAction(shopCode, productSlug)
      if (requestGeneration !== generation.current) return
      setRequiresSignIn(Boolean(state.requires_sign_in))
      setMessage(state.message)
      if (state.success && state.data) {
        rememberTask(state.data.id)
        setTask(state.data)
        onCodesConfirmed(state.data.discount_codes)
      }
    })
  }

  const availableCodes =
    task?.discount_codes.filter((code) => code.is_available) ?? []
  const taskExpired = task?.status === "expired"
  const pending = disabled || startPending || checkPending

  return (
    <section
      aria-label="Làm nhiệm vụ nhận mã giảm giá"
      className="space-y-3 rounded-lg border bg-muted/30 p-4"
    >
      <p className="flex items-center gap-2 font-medium">
        <GiftIcon className="size-4 text-primary" /> Làm nhiệm vụ nhận mã
      </p>
      {configPending ? (
        <p className="text-sm text-muted-foreground">Đang tải nhiệm vụ...</p>
      ) : config?.enabled ? (
        <>
          <p className="text-sm text-muted-foreground">
            Mỗi mốc nhiệm vụ hợp lệ được nhà cung cấp xác nhận sẽ nhận 1 mã giảm{" "}
            {formatCurrency(task?.reward_amount ?? config.reward_amount)} cho
            sản phẩm này. Đọc điều kiện của từng nhiệm vụ trước khi tham gia;
            thời gian xác nhận có thể khác nhau.
          </p>
          {!task || taskExpired ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={startTask}
            >
              {startPending ? "Đang chuẩn bị..." : "Lấy mã giảm giá"}
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <a
                className={buttonVariants({ variant: "outline", size: "sm" })}
                href={task.offerwall_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
              >
                Mở trang nhiệm vụ <ExternalLinkIcon className="size-4" />
                <span className="sr-only"> (tab mới)</span>
              </a>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => checkTask(task.id)}
              >
                {checkPending ? "Đang kiểm tra..." : "Kiểm tra mã"}
              </Button>
            </div>
          )}
          {taskExpired ? (
            <p className="text-sm text-muted-foreground">
              Phiên nhiệm vụ đã hết hạn. Mã đã nhận vẫn nằm trong kho mã của
              bạn.
            </p>
          ) : task ? (
            <p className="text-xs text-muted-foreground">
              Hoàn thành điều kiện trên trang nhiệm vụ rồi quay lại đây kiểm tra
              mã. Chỉ mở trang sẽ chưa được nhận mã.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nhiệm vụ nhận mã đang được chuẩn bị. Bạn vẫn có thể đặt hàng bình
          thường.
        </p>
      )}
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {requiresSignIn ? (
        <Link
          className="text-sm text-primary underline"
          href={getAuthPageHref(
            "/sign-in",
            `/shops/${encodeURIComponent(shopCode)}/products/${encodeURIComponent(productSlug)}`
          )}
        >
          Đăng nhập để nhận mã
        </Link>
      ) : null}
      {availableCodes.length > 0 ? (
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">
            Đã xác nhận {availableCodes.length} mã giảm giá còn dùng được
          </p>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => onUseCodes(availableCodes)}
          >
            Dùng mã cho đơn này
          </Button>
          <Link
            className="ml-3 text-sm text-primary underline"
            href="/discount-codes"
          >
            Xem kho mã
          </Link>
        </div>
      ) : null}
    </section>
  )
}
