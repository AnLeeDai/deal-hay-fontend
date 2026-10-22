"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  BellIcon,
  CheckCheckIcon,
  ExternalLinkIcon,
  MessageSquareWarningIcon,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormSubmitButton } from "@/components/form-submit-button"
import { DataPagination } from "@/components/layout/data-pagination"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { useRealtime } from "@/components/realtime-provider"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/format"
import { applyServerErrors } from "@/lib/form-utils"
import type { PaginatedResponse } from "@/types/common"
import type { AppNotification } from "@/types/notification"
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  notificationAppealAction,
  synchronizeNotificationsAction,
} from "@/modules/notifications/actions"
import {
  notificationAppealSchema,
  type NotificationAppealValues,
} from "@/modules/notifications/schemas/notifications"

function NotificationAppealForm({
  notificationId,
}: {
  notificationId: string
}) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<NotificationAppealValues>({
    resolver: zodResolver(notificationAppealSchema),
    defaultValues: {
      notification_id: notificationId,
      message: "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await notificationAppealAction(values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset({ notification_id: notificationId, message: "" })
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form className="space-y-3" noValidate onSubmit={onSubmit}>
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Khiếu nại thông báo này</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Mô tả lý do cần admin hỗ trợ..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormSubmitButton
          idleText="Gửi khiếu nại"
          pending={isPending}
          pendingText="Đang gửi..."
          variant="outline"
        />
      </form>
    </Form>
  )
}

export function NotificationsPageClient({
  page,
  currentUserId,
}: {
  page: PaginatedResponse<AppNotification>
  currentUserId?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [notificationPage, setNotificationPage] = useState(page)
  const [newNotificationCount, setNewNotificationCount] = useState(0)
  const notificationRevision = useRef(0)
  const knownNotificationIds = useRef(new Set(page.data.map(({ id }) => id)))
  const { echo, synchronizeUnreadCounts } = useRealtime()
  const currentPage = page.current_page ?? 1
  const pageSize =
    "per_page" in page && typeof page.per_page === "number" && page.per_page > 0
      ? page.per_page
      : 20

  useEffect(() => {
    if (!echo || !currentUserId) return

    let disposed = false
    let synchronizing = false
    let synchronizationRequested = false
    const channel = echo.private(`user-notifications.${currentUserId}`)

    const synchronize = async () => {
      synchronizationRequested = true
      if (synchronizing) return
      synchronizing = true

      try {
        while (synchronizationRequested && !disposed) {
          synchronizationRequested = false
          const revision = notificationRevision.current
          const updatedPage = await synchronizeNotificationsAction(currentPage)
          if (disposed) return
          if (revision !== notificationRevision.current) {
            synchronizationRequested = true
            continue
          }
          if (updatedPage) {
            updatedPage.data.forEach(({ id }) =>
              knownNotificationIds.current.add(id)
            )
            setNotificationPage(updatedPage)
          }
        }
      } catch {
        // Preserve the displayed notifications if reconnect synchronization fails.
      } finally {
        synchronizing = false
      }
    }

    const onSubscribed = () => void synchronize()
    const onNotification = (payload: unknown) => {
      if (
        disposed ||
        !payload ||
        typeof payload !== "object" ||
        !("id" in payload) ||
        typeof payload.id !== "string" ||
        !("title" in payload) ||
        typeof payload.title !== "string" ||
        !("body" in payload) ||
        typeof payload.body !== "string"
      ) {
        return
      }

      const notification = payload as AppNotification
      const isNew = !knownNotificationIds.current.has(notification.id)
      knownNotificationIds.current.add(notification.id)
      notificationRevision.current += 1
      setNotificationPage((previous) => {
        const data = previous.data.map((existing) =>
          existing.id === notification.id
            ? {
                ...existing,
                ...notification,
                read_at: existing.read_at ?? notification.read_at,
              }
            : existing
        )
        const total = previous.total + (isNew ? 1 : 0)

        return {
          ...previous,
          data:
            currentPage === 1 && isNew
              ? [notification, ...data].slice(0, pageSize)
              : data,
          total,
          last_page: Math.max(1, Math.ceil(total / pageSize)),
        }
      })
      if (isNew && currentPage > 1) {
        setNewNotificationCount((previous) => previous + 1)
      }
    }

    channel.listen(".notification.created", onNotification)
    channel.listen(".pusher:subscription_succeeded", onSubscribed)
    if (channel.subscription.subscribed) void synchronize()

    return () => {
      disposed = true
      channel.stopListening(".notification.created", onNotification)
      channel.stopListening(".pusher:subscription_succeeded", onSubscribed)
    }
  }, [currentPage, currentUserId, echo, pageSize])

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <Button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await markAllNotificationsReadAction()
                  notificationRevision.current += 1
                  const readAt = new Date().toISOString()
                  setNotificationPage((previous) => ({
                    ...previous,
                    data: previous.data.map((notification) => ({
                      ...notification,
                      read_at: notification.read_at ?? readAt,
                    })),
                  }))
                  void synchronizeUnreadCounts()
                  toast.success("Đã đánh dấu tất cả thông báo là đã đọc.")
                } catch {
                  toast.error("Không thể cập nhật thông báo.")
                }
              })
            }
          >
            <CheckCheckIcon />{" "}
            {isPending ? "Đang cập nhật..." : "Đánh dấu tất cả đã đọc"}
          </Button>
        }
        description="Xem trạng thái thông báo, đánh dấu đã đọc hoặc gửi ticket khiếu nại nếu cần."
        title="Trung tâm thông báo"
      />
      {newNotificationCount > 0 ? (
        <div
          className="flex items-center justify-between gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4"
          role="status"
        >
          <p className="text-sm">Có {newNotificationCount} thông báo mới.</p>
          <Link
            href="/notifications"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Xem mới nhất
          </Link>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {notificationPage.data.map((notification) => (
          <Card
            key={notification.id}
            className={!notification.read_at ? "ring-primary/30" : undefined}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <BellIcon className="size-4" />
                </span>
                <div>
                  <CardTitle className="text-base">
                    {notification.title}
                  </CardTitle>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {notification.body}
                  </p>
                </div>
              </div>
              <Badge variant={notification.read_at ? "outline" : "default"}>
                {notification.read_at ? "Đã đọc" : "Chưa đọc"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {formatDate(notification.created_at)}
              </p>
              <div className="flex flex-wrap gap-3">
                {notification.action_url ? (
                  <Link
                    href={notification.action_url}
                    className={buttonVariants({
                      size: "sm",
                      variant: "outline",
                    })}
                  >
                    <ExternalLinkIcon /> Xem chi tiết
                  </Link>
                ) : null}
                {!notification.read_at ? (
                  <Button
                    disabled={isPending}
                    variant="outline"
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await markNotificationReadAction(notification.id)
                          notificationRevision.current += 1
                          const readAt = new Date().toISOString()
                          setNotificationPage((previous) => ({
                            ...previous,
                            data: previous.data.map((existing) =>
                              existing.id === notification.id
                                ? { ...existing, read_at: readAt }
                                : existing
                            ),
                          }))
                          void synchronizeUnreadCounts()
                          toast.success("Đã đánh dấu thông báo là đã đọc.")
                        } catch {
                          toast.error("Không thể cập nhật thông báo.")
                        }
                      })
                    }
                  >
                    <CheckCheckIcon /> Đánh dấu đã đọc
                  </Button>
                ) : null}
              </div>
              <Accordion>
                <AccordionItem value="appeal">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <MessageSquareWarningIcon className="size-4" /> Cần hỗ trợ
                      về thông báo này?
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <NotificationAppealForm notificationId={notification.id} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        ))}
        {notificationPage.data.length === 0 ? (
          <EmptyState
            title="Bạn chưa có thông báo"
            description="Cập nhật về tài khoản, cửa hàng và hoạt động mua sắm sẽ xuất hiện tại đây."
          />
        ) : null}
      </div>
      <DataPagination
        currentPage={notificationPage.current_page}
        lastPage={notificationPage.last_page}
      />
    </div>
  )
}
