"use client"

import Link from "next/link"
import { useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormSubmitButton } from "@/components/form-submit-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { applyServerErrors } from "@/lib/form-utils"
import { signInAction } from "@/modules/auth/actions"
import { signInSchema, type SignInValues } from "@/modules/auth/schemas/auth"

export function SignInForm() {
  const [isPending, startTransition] = useTransition()
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
      admin_verification_code: "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await signInAction(values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (!state.success && !hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đăng nhập</CardTitle>
        <CardDescription>
          Đăng nhập để quản lý hồ sơ, shop, thông báo và tin nhắn.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form className="space-y-4" noValidate onSubmit={onSubmit}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      type="text"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mật khẩu</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="current-password"
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="admin_verification_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã xác minh admin (nếu có)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      type="text"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormSubmitButton
              className="w-full"
              idleText="Đăng nhập"
              pending={isPending}
              pendingText="Đang đăng nhập..."
            />
          </form>
        </Form>
        <div className="flex items-center justify-between text-sm">
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href="/forgot-password"
          >
            Quên mật khẩu?
          </Link>
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href="/sign-up"
          >
            Tạo tài khoản
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
