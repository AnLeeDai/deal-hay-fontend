"use client"

import { useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormSubmitButton } from "@/components/form-submit-button"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { applyServerErrors } from "@/lib/form-utils"
import type { ProductCategory } from "@/types/admin"
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/modules/admin/actions"
import { AdminNavigation } from "@/modules/admin/components/admin-navigation"
import {
  categorySchema,
  type CategoryValues,
} from "@/modules/admin/schemas/admin"

function CategoryItem({ category }: { category: ProductCategory }) {
  const [isPending, startTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()
  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category.name,
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await updateCategoryAction(category.id, values)
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
    <div className="rounded-lg border p-4">
      <Form {...form}>
        <form
          className="flex flex-col gap-3 md:flex-row md:items-start"
          noValidate
          onSubmit={onSubmit}
        >
          <div className="flex-1">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Tên danh mục" type="text" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex gap-2">
            <FormSubmitButton
              idleText="Lưu"
              pending={isPending}
              pendingText="Đang lưu..."
              variant="outline"
            />
            <Button
              disabled={isDeletePending}
              type="button"
              variant="destructive"
              onClick={() => {
                startDeleteTransition(async () => {
                  try {
                    await deleteCategoryAction(category.id)
                    toast.success("Đã xoá danh mục.")
                  } catch {
                    toast.error("Không thể xoá danh mục.")
                  }
                })
              }}
            >
              {isDeletePending ? "Đang xoá..." : "Xoá"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

export function AdminCategoriesClient({
  categories,
}: {
  categories: ProductCategory[]
}) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await createCategoryAction(values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset({ name: "" })
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Quản lý danh mục"
        description="Admin quản lý danh mục toàn hệ thống dùng chung cho các shop."
      />
      <AdminNavigation />
      <Card>
        <CardHeader>
          <CardTitle>Thêm danh mục mới</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="flex flex-col gap-3 md:flex-row md:items-start"
              noValidate
              onSubmit={onSubmit}
            >
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Tên danh mục mới"
                          type="text"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormSubmitButton
                idleText="Thêm danh mục"
                pending={isPending}
                pendingText="Đang thêm..."
              />
            </form>
          </Form>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {categories.map((category) => (
          <CategoryItem key={category.id} category={category} />
        ))}
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có danh mục nào.</p>
        ) : null}
      </div>
    </div>
  )
}
