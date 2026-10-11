"use client"

import Link from "next/link"
import { useTransition } from "react"
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
}: {
  page: PaginatedResponse<AppNotification>
}) {
  const [isPending, startTransition] = useTransition()

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
      <div className="grid gap-4 lg:grid-cols-2">
        {page.data.map((notification) => (
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
                  <Button
                    nativeButton={false}
                    render={<Link href={notification.action_url} />}
                    size="sm"
                    variant="outline"
                  >
                    <ExternalLinkIcon /> Xem chi tiết
                  </Button>
                ) : null}
                {!notification.read_at ? (
                  <Button
                    disabled={isPending}
                    variant="outline"
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await markNotificationReadAction(notification.id)
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
        {page.data.length === 0 ? (
          <EmptyState
            title="Bạn chưa có thông báo"
            description="Cập nhật về tài khoản, cửa hàng và hoạt động mua sắm sẽ xuất hiện tại đây."
          />
        ) : null}
      </div>
      <DataPagination
        currentPage={page.current_page}
        lastPage={page.last_page}
      />
    </div>
  )
}
