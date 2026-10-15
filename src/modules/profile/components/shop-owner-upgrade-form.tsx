"use client"

import { useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormSubmitButton } from "@/components/form-submit-button"
import { AddressFields } from "@/components/address-fields"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { applyServerErrors } from "@/lib/form-utils"
import type { User } from "@/types/auth"
import { shopOwnerUpgradeAction } from "@/modules/profile/actions"
import {
  shopOwnerUpgradeSchema,
  type ShopOwnerUpgradeValues,
} from "@/modules/profile/schemas/profile"

export function ShopOwnerUpgradeForm({ user }: { user: User }) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<ShopOwnerUpgradeValues>({
    resolver: zodResolver(shopOwnerUpgradeSchema),
    defaultValues: {
      shop_name: user.shop_name ?? "",
      shop_email: user.shop_email ?? "",
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number ?? "",
      shop_phone_number: user.shop_phone_number ?? "",
      province: user.province ?? "",
      ward: user.ward ?? "",
      address_detail: user.address_detail ?? "",
      message: "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await shopOwnerUpgradeAction(values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset({ ...values, message: "" })
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <FormField
          control={form.control}
          name="shop_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tên shop</FormLabel>
              <FormControl>
                <Input type="text" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="shop_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email shop</FormLabel>
              <FormControl>
                <Input inputMode="email" type="text" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Họ tên</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email cá nhân</FormLabel>
                <FormControl>
                  <Input inputMode="email" type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SĐT cá nhân</FormLabel>
                <FormControl>
                  <Input inputMode="tel" type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shop_phone_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SĐT shop</FormLabel>
                <FormControl>
                  <Input inputMode="tel" type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <AddressFields form={form} provinceName="province" wardName="ward" />
        </div>
        <FormField
          control={form.control}
          name="address_detail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Địa chỉ chi tiết</FormLabel>
              <FormControl>
                <Input type="text" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lời nhắn</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormSubmitButton
          idleText="Gửi yêu cầu"
          pending={isPending}
          pendingText="Đang gửi..."
        />
      </form>
    </Form>
  )
}
