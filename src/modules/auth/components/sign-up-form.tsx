"use client"

import { Checkbox } from "@/components/ui/checkbox"
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
import { getAuthPageHref } from "@/lib/auth-redirect"
import { applyServerErrors } from "@/lib/form-utils"
import { signUpAction } from "@/modules/auth/actions"
import { signUpSchema, type SignUpValues } from "@/modules/auth/schemas/auth"

export function SignUpForm({ redirectTo }: { redirectTo?: string }) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      password_confirmation: "",
      accept_terms: false,
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await signUpAction(values, redirectTo)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (!state.success && !hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đăng ký tài khoản</CardTitle>
        <CardDescription>
          Tạo tài khoản Deal Hay để theo dõi shop, nhắn tin và nhận thông báo.
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
                      autoComplete="new-password"
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
              name="password_confirmation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Xác nhận mật khẩu</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="new-password"
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
              name="accept_terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="items-start">
                    <Checkbox
                      checked={field.value}
                      onBlur={field.onBlur}
                      onCheckedChange={field.onChange}
                    />
                    <span>
                      Tôi đồng ý với điều khoản sử dụng và chính sách của Deal
                      Hay.
                    </span>
                  </FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormSubmitButton
              className="w-full"
              idleText="Đăng ký"
              pending={isPending}
              pendingText="Đang tạo tài khoản..."
            />
          </form>
        </Form>
        <p className="text-sm text-muted-foreground">
          Đã có tài khoản?{" "}
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href={getAuthPageHref("/sign-in", redirectTo)}
          >
            Đăng nhập ngay
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
