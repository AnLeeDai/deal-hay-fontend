"use client"

import { useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormSelect } from "@/components/form-select"
import { FormSubmitButton } from "@/components/form-submit-button"
import { DataPagination } from "@/components/layout/data-pagination"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
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
import { UserAvatar } from "@/components/user-avatar"
import { applyServerErrors } from "@/lib/form-utils"
import type { PaginatedResponse } from "@/types/common"
import type { Ticket } from "@/types/ticket"
import { reviewTicketAction } from "@/modules/admin/actions"
import { AdminNavigation } from "@/modules/admin/components/admin-navigation"
import {
  reviewTicketSchema,
  type ReviewTicketValues,
} from "@/modules/admin/schemas/admin"

function TicketForm({ ticket }: { ticket: Ticket }) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<ReviewTicketValues>({
    resolver: zodResolver(reviewTicketSchema),
    defaultValues: {
      status:
        ticket.status === "approved" || ticket.status === "rejected"
          ? ticket.status
          : "approved",
      admin_note: ticket.admin_note ?? "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await reviewTicketAction(ticket.id, values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserAvatar
            name={ticket.user?.full_name ?? "Ẩn danh"}
            size="lg"
            src={ticket.user?.avatar_url}
          />
          <div>
            <CardTitle className="text-base">{ticket.type_label}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {ticket.user?.full_name ?? "Ẩn danh"} • {ticket.source_label}
            </p>
          </div>
        </div>
        <Badge
          variant={
            ticket.status === "approved"
              ? "default"
              : ticket.status === "rejected"
                ? "destructive"
                : "outline"
          }
        >
          {ticket.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{ticket.message}</p>
        <Form {...form}>
          <form
            className="space-y-3 rounded-lg border p-3"
            noValidate
            onSubmit={onSubmit}
          >
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trạng thái</FormLabel>
                  <FormSelect
                    inputRef={field.ref}
                    name={field.name}
                    options={[
                      { label: "Duyệt", value: "approved" },
                      { label: "Từ chối", value: "rejected" },
                    ]}
                    value={field.value}
                    onBlur={field.onBlur}
                    onValueChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="admin_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú admin</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ghi chú admin"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormSubmitButton
              idleText="Cập nhật ticket"
              pending={isPending}
              pendingText="Đang lưu..."
            />
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export function AdminTicketsClient({
  tickets,
}: {
  tickets: PaginatedResponse<Ticket>
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Yêu cầu hỗ trợ"
        description="Xử lý yêu cầu nâng cấp cửa hàng và các khiếu nại từ người dùng."
      />
      <AdminNavigation />
      <div className="grid gap-4">
        {tickets.data.map((ticket) => (
          <TicketForm key={ticket.id} ticket={ticket} />
        ))}
        {tickets.data.length === 0 ? (
          <EmptyState
            title="Không có yêu cầu chờ xử lý"
            description="Các yêu cầu hỗ trợ mới sẽ xuất hiện tại đây."
          />
        ) : null}
      </div>
      <DataPagination
        currentPage={tickets.current_page}
        lastPage={tickets.last_page}
      />
    </div>
  )
}
