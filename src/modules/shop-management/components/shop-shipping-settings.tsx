"use client"

import { useEffect, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, Trash2Icon, TruckIcon } from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"

import type { Ward } from "@/api/lookups/types"
import { FormSelect } from "@/components/form-select"
import { FormSubmitButton } from "@/components/form-submit-button"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { applyServerErrors } from "@/lib/form-utils"
import { shippingSettingsSchema } from "@/modules/shop-management/schemas/shipping-settings"
import {
  loadShopShippingSettingsAction,
  updateShopShippingSettingsAction,
} from "@/modules/shop-management/shipping-actions"
import type { ShippingSettings } from "@/types/shipping"

export function ShopShippingSettings() {
  const [isPending, startTransition] = useTransition()
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [retry, setRetry] = useState(0)
  const [wards, setWards] = useState<Ward[]>([])
  const form = useForm<ShippingSettings>({
    resolver: zodResolver(shippingSettingsSchema),
    defaultValues: { enabled: false, base_fee: Number.NaN, ward_rates: [] },
  })
  const { reset } = form
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "ward_rates",
  })

  useEffect(() => {
    let active = true
    startTransition(async () => {
      try {
        const state = await loadShopShippingSettingsAction()
        if (!active) return
        if (state.success && state.shipping_settings) {
          reset(state.shipping_settings)
          setWards(state.wards ?? [])
          setLoaded(true)
          setLoadError("")
        } else {
          setLoadError(state.message)
        }
      } catch {
        if (active) {
          setLoadError(
            "Không thể tải cài đặt phí vận chuyển. Vui lòng thử lại."
          )
        }
      }
    })
    return () => {
      active = false
    }
  }, [reset, retry])

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      try {
        const state = await updateShopShippingSettingsAction(values)
        const hasFieldErrors = applyServerErrors(state.errors, form.setError)
        if (state.success && state.shipping_settings) {
          reset(state.shipping_settings)
          toast.success(state.message)
        } else if (!hasFieldErrors) {
          toast.error(state.message)
        }
      } catch {
        toast.error("Không thể lưu phí vận chuyển. Vui lòng thử lại.")
      }
    })
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TruckIcon className="size-5 text-primary" /> Phí vận chuyển Hà Nội
        </CardTitle>
        <CardDescription>
          Nhập mức phí shop áp dụng. Phí riêng của phường/xã sẽ thay thế phí mặc
          định; các địa điểm còn lại tại Hà Nội dùng phí mặc định.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <div className="flex flex-wrap items-center gap-3" role="alert">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button
              disabled={isPending}
              type="button"
              variant="outline"
              onClick={() => setRetry((value) => value + 1)}
            >
              Thử lại
            </Button>
          </div>
        ) : !loaded ? (
          <p className="text-sm text-muted-foreground" role="status">
            Đang tải cài đặt phí vận chuyển...
          </p>
        ) : (
          <Form {...form}>
            <form noValidate onSubmit={onSubmit}>
              <fieldset className="space-y-5" disabled={isPending}>
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-4">
                      <div className="space-y-1">
                        <FormLabel>Áp dụng phí vận chuyển tại Hà Nội</FormLabel>
                        <FormDescription>
                          Bật sau khi đã nhập mức phí shop áp dụng.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          disabled={isPending}
                          onBlur={field.onBlur}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="base_fee"
                  render={({ field }) => (
                    <FormItem className="max-w-sm">
                      <FormLabel>Phí mặc định (đồng)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="numeric"
                          max={999999999}
                          min={0}
                          placeholder="Nhập phí vận chuyển"
                          step={1}
                          type="number"
                          value={
                            Number.isFinite(field.value) ? field.value : ""
                          }
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === ""
                                ? Number.NaN
                                : Number(event.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    Phí riêng theo phường/xã (tùy chọn)
                  </p>
                  {fields.map((rate, index) => (
                    <div
                      key={rate.id}
                      className="grid items-start gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                    >
                      <FormField
                        control={form.control}
                        name={`ward_rates.${index}.ward_code`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phường / xã</FormLabel>
                            <FormSelect
                              disabled={isPending}
                              inputRef={field.ref}
                              name={field.name}
                              options={wards.map((ward) => ({
                                label: ward.name,
                                value: String(ward.code),
                              }))}
                              placeholder="Chọn phường / xã Hà Nội"
                              value={field.value ? String(field.value) : ""}
                              onBlur={field.onBlur}
                              onValueChange={(value) =>
                                field.onChange(Number(value))
                              }
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`ward_rates.${index}.fee`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phí vận chuyển (đồng)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                inputMode="numeric"
                                max={999999999}
                                min={0}
                                placeholder="Nhập phí riêng"
                                step={1}
                                type="number"
                                value={
                                  Number.isFinite(field.value)
                                    ? field.value
                                    : ""
                                }
                                onChange={(event) =>
                                  field.onChange(
                                    event.target.value === ""
                                      ? Number.NaN
                                      : Number(event.target.value)
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        aria-label={`Xóa mức phí riêng ${index + 1}`}
                        className="sm:mt-7"
                        size="icon"
                        type="button"
                        variant="outline"
                        onClick={() => remove(index)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  ))}
                  <Button
                    disabled={
                      wards.length === 0 || fields.length >= wards.length
                    }
                    type="button"
                    variant="outline"
                    onClick={() => append({ ward_code: 0, fee: Number.NaN })}
                  >
                    <PlusIcon /> Thêm phí theo phường/xã
                  </Button>
                </div>
                <FormSubmitButton
                  disabled={!form.formState.isDirty}
                  idleText="Lưu phí vận chuyển"
                  pending={isPending}
                  pendingText="Đang lưu..."
                />
              </fieldset>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  )
}
