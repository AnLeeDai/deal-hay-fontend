"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormSubmitButton } from "@/components/form-submit-button"
import { PasswordInput } from "@/components/password-input"
import { Button } from "@/components/ui/button"
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
import { signInAction } from "@/modules/auth/actions"
import { signInSchema, type SignInValues } from "@/modules/auth/schemas/auth"

export function SignInForm({ redirectTo }: { redirectTo?: string }) {
  const [isPending, startTransition] = useTransition()
  const [requiresAdminVerification, setRequiresAdminVerification] =
    useState(false)
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
      admin_verification_code: "",
    },
  })

  const resetAdminVerification = () => {
    setRequiresAdminVerification(false)
    form.setValue("admin_verification_code", "")
    form.clearErrors("admin_verification_code")
  }

  const submitSignIn = (values: SignInValues, resendCode = false) => {
    if (
      requiresAdminVerification &&
      !resendCode &&
      !values.admin_verification_code
    ) {
      form.setError("admin_verification_code", {
        type: "required",
        message: "Vui lòng nhập mã xác minh gồm 6 chữ số.",
      })
      form.setFocus("admin_verification_code")
      return
    }

    startTransition(async () => {
      const state = await signInAction(values, redirectTo)

      if (state.requiresAdminVerification) {
        setRequiresAdminVerification(true)
      }

      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (!state.success && !hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  }

  const onSubmit = form.handleSubmit((values) => submitSignIn(values))

  const resendVerificationCode = () => {
    form.setValue("admin_verification_code", "")
    form.clearErrors("admin_verification_code")
    void form.handleSubmit((values) => submitSignIn(values, true))()
  }

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
                      disabled={isPending}
                      onChange={(event) => {
                        field.onChange(event)
                        resetAdminVerification()
                      }}
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
                    <PasswordInput
                      autoComplete="current-password"
                      {...field}
                      disabled={isPending}
                      onChange={(event) => {
                        field.onChange(event)
                        resetAdminVerification()
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {requiresAdminVerification ? (
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="admin_verification_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mã xác minh quản trị viên</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="one-time-code"
                          autoFocus
                          disabled={isPending}
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
                <Button
                  className="h-auto px-0"
                  disabled={isPending}
                  onClick={resendVerificationCode}
                  type="button"
                  variant="link"
                >
                  Gửi lại mã xác minh
                </Button>
              </div>
            ) : null}
            <FormSubmitButton
              className="w-full"
              idleText={
                requiresAdminVerification
                  ? "Xác minh và đăng nhập"
                  : "Đăng nhập"
              }
              pending={isPending}
              pendingText={
                requiresAdminVerification
                  ? "Đang xác minh..."
                  : "Đang đăng nhập..."
              }
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
            href={getAuthPageHref("/sign-up", redirectTo)}
          >
            Tạo tài khoản
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
