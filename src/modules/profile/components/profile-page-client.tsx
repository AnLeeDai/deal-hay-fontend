"use client"

import { useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { KeyRoundIcon, StoreIcon, UserRoundIcon } from "lucide-react"

import { FormSubmitButton } from "@/components/form-submit-button"
import { PageHeader } from "@/components/layout/page-header"
import { SelectedFilePreview } from "@/components/selected-file-preview"
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
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserAvatar } from "@/components/user-avatar"
import { appendOptionalFile, applyServerErrors } from "@/lib/form-utils"
import type { User } from "@/types/auth"
import {
  shopOwnerUpgradeAction,
  updateAvatarAction,
  updatePasswordAction,
  updateProfileAction,
} from "@/modules/profile/actions"
import {
  avatarSchema,
  shopOwnerUpgradeSchema,
  updatePasswordSchema,
  updateProfileSchema,
  type ShopOwnerUpgradeValues,
  type UpdatePasswordValues,
  type UpdateProfileValues,
} from "@/modules/profile/schemas/profile"

function ProfileInfoForm({ user }: { user: User }) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number ?? "",
      province: user.province ?? "",
      ward: user.ward ?? "",
      address_detail: user.address_detail ?? "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await updateProfileAction(values)
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
    <Form {...form}>
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
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
            name="phone_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số điện thoại</FormLabel>
                <FormControl>
                  <Input
                    inputMode="tel"
                    type="text"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="province"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tỉnh / thành</FormLabel>
                <FormControl>
                  <Input type="text" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ward"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phường / xã</FormLabel>
                <FormControl>
                  <Input type="text" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address_detail"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Địa chỉ chi tiết</FormLabel>
                <FormControl>
                  <Input type="text" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormSubmitButton
          idleText="Lưu thông tin"
          pending={isPending}
          pendingText="Đang lưu..."
        />
      </form>
    </Form>
  )
}

function PasswordForm() {
  const [isPending, startTransition] = useTransition()
  const form = useForm<UpdatePasswordValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      current_password: "",
      password: "",
      password_confirmation: "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await updatePasswordAction(values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset()
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
          name="current_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mật khẩu hiện tại</FormLabel>
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mật khẩu mới</FormLabel>
              <FormControl>
                <Input autoComplete="new-password" type="password" {...field} />
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
              <FormLabel>Xác nhận mật khẩu mới</FormLabel>
              <FormControl>
                <Input autoComplete="new-password" type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormSubmitButton
          idleText="Cập nhật mật khẩu"
          pending={isPending}
          pendingText="Đang cập nhật..."
        />
      </form>
    </Form>
  )
}

function AvatarForm() {
  const [isPending, startTransition] = useTransition()
  const form = useForm<z.infer<typeof avatarSchema>>({
    resolver: zodResolver(avatarSchema),
    defaultValues: {
      avatar: undefined,
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData()
    appendOptionalFile(formData, "avatar", values.avatar)

    startTransition(async () => {
      const state = await updateAvatarAction(formData)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset({ avatar: undefined })
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
          name="avatar"
          render={({ field: { onChange, value, ...field } }) => (
            <FormItem>
              <FormLabel>Ảnh đại diện</FormLabel>
              <FormControl>
                <div>
                  {value instanceof File ? (
                    <SelectedFilePreview
                      file={value}
                      onRemove={() => onChange(undefined)}
                    />
                  ) : (
                    <Input
                      accept="image/*"
                      name={field.name}
                      ref={field.ref}
                      type="file"
                      onBlur={field.onBlur}
                      onChange={(event) =>
                        onChange(event.target.files?.[0] ?? undefined)
                      }
                    />
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormSubmitButton
          idleText="Cập nhật avatar"
          pending={isPending}
          pendingText="Đang tải lên..."
        />
      </form>
    </Form>
  )
}

function ShopOwnerUpgradeForm({ user }: { user: User }) {
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
          <FormField
            control={form.control}
            name="province"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tỉnh / thành</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ward"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phường / xã</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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

export function ProfilePageClient({ user }: { user: User }) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Tài khoản của tôi"
        description="Quản lý hồ sơ, bảo mật và quyền bán hàng của bạn tại một nơi."
      />
      <Card className="bg-foreground text-background ring-0">
        <CardContent className="flex-col items-start gap-5 sm:flex-row sm:items-center">
          <UserAvatar
            className="size-20 border-4 border-background/10"
            name={user.full_name}
            size="lg"
            src={user.avatar_url}
          />
          <div className="min-w-0 flex-1">
            <p className="font-heading text-2xl font-semibold">
              {user.full_name}
            </p>
            <p className="mt-1 text-sm text-background/60">
              {user.email} · {user.user_code}
            </p>
          </div>
          <div className="rounded-lg bg-background/10 px-3 py-2 text-xs font-medium">
            {user.role === "shop_owner"
              ? "Chủ cửa hàng"
              : user.role === "administrator"
                ? "Quản trị viên"
                : "Khách hàng"}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit sm:grid-cols-3">
          <TabsTrigger value="profile">
            <UserRoundIcon /> Hồ sơ
          </TabsTrigger>
          <TabsTrigger value="security">
            <KeyRoundIcon /> Bảo mật
          </TabsTrigger>
          {user.role === "customer" ? (
            <TabsTrigger className="col-span-2 sm:col-span-1" value="seller">
              <StoreIcon /> Bán hàng
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent className="pt-4" value="profile">
          <div className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
            <Card>
              <CardHeader>
                <CardTitle>Thông tin cá nhân</CardTitle>
                <CardDescription>
                  Thông tin dùng để liên hệ và hiển thị trên tài khoản.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProfileInfoForm user={user} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Ảnh đại diện</CardTitle>
                <CardDescription>
                  Ảnh rõ nét giúp người bán dễ nhận biết bạn hơn.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <UserAvatar
                    className="size-20"
                    name={user.full_name}
                    size="lg"
                    src={user.avatar_url}
                  />
                  <div>
                    <p className="font-medium">{user.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Ảnh đại diện hiện tại
                    </p>
                  </div>
                </div>
                <AvatarForm />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent className="pt-4" value="security">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Đổi mật khẩu</CardTitle>
              <CardDescription>
                Sử dụng mật khẩu mạnh và không chia sẻ với người khác.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordForm />
            </CardContent>
          </Card>
        </TabsContent>

        {user.role === "customer" ? (
          <TabsContent className="pt-4" value="seller">
            <Card>
              <CardHeader>
                <CardTitle>Đăng ký trở thành người bán</CardTitle>
                <CardDescription>
                  Gửi thông tin cửa hàng để quản trị viên xem xét và kích hoạt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ShopOwnerUpgradeForm user={user} />
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
