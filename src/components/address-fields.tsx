"use client"

import { useEffect, useState } from "react"
import {
  useWatch,
  type FieldPath,
  type FieldPathValue,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form"

import { loadProvincesAction, loadWardsAction } from "@/api/lookups/actions"
import type { Province, Ward } from "@/api/lookups/types"
import { Button } from "@/components/ui/button"
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { FormSelect, type FormSelectOption } from "@/components/form-select"

type LookupState<T> = { data: T[]; loading: boolean; error?: string }

function withExistingValue(
  options: FormSelectOption[],
  value: string
): FormSelectOption[] {
  if (!value || options.some((option) => option.value === value)) return options
  return [
    { value, label: `${value} (vui lòng chọn lại)`, disabled: true },
    ...options,
  ]
}

export function AddressFields<T extends FieldValues>({
  form,
  provinceName,
  wardName,
  valueMode = "name",
}: {
  form: UseFormReturn<T>
  provinceName: FieldPath<T>
  wardName: FieldPath<T>
  valueMode?: "name" | "code"
}) {
  const provinceValue = String(
    useWatch({ control: form.control, name: provinceName }) ?? ""
  )
  const [provinces, setProvinces] = useState<LookupState<Province>>({
    data: [],
    loading: true,
  })
  const [wards, setWards] = useState<
    LookupState<Ward> & { provinceCode?: string }
  >({ data: [], loading: false })
  const [provinceRetry, setProvinceRetry] = useState(0)
  const [wardRetry, setWardRetry] = useState(0)
  const selectedProvince = provinces.data.find(
    (province) =>
      (valueMode === "code" ? String(province.code) : province.name) ===
      provinceValue
  )
  const provinceCode = selectedProvince ? String(selectedProvince.code) : ""
  const wardsReady =
    Boolean(provinceCode) && wards.provinceCode === provinceCode

  useEffect(() => {
    let active = true
    loadProvincesAction()
      .then((result) => {
        if (active) setProvinces({ ...result, loading: false })
      })
      .catch(() => {
        if (active)
          setProvinces({
            data: [],
            loading: false,
            error: "Không tải được danh sách tỉnh/thành. Vui lòng thử lại.",
          })
      })
    return () => {
      active = false
    }
  }, [provinceRetry])

  useEffect(() => {
    if (!provinceCode) return
    let active = true
    loadWardsAction(provinceCode)
      .then((result) => {
        if (active) setWards({ ...result, provinceCode, loading: false })
      })
      .catch(() => {
        if (active)
          setWards({
            data: [],
            provinceCode,
            loading: false,
            error: "Không tải được danh sách phường/xã. Vui lòng thử lại.",
          })
      })
    return () => {
      active = false
    }
  }, [provinceCode, wardRetry])

  const provinceOptions = provinces.data.map((province) => ({
    label: province.name,
    value: valueMode === "code" ? String(province.code) : province.name,
  }))
  const wardOptions = (wardsReady ? wards.data : []).map((ward) => ({
    label: ward.name,
    value: valueMode === "code" ? String(ward.code) : ward.name,
  }))

  return (
    <>
      <FormField
        control={form.control}
        name={provinceName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tỉnh / thành</FormLabel>
            <FormSelect
              disabled={provinces.loading || Boolean(provinces.error)}
              inputRef={field.ref}
              name={field.name}
              onBlur={field.onBlur}
              onValueChange={(value) => {
                field.onChange(value)
                form.setValue(wardName, "" as FieldPathValue<T, FieldPath<T>>, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }}
              options={withExistingValue(
                provinceOptions,
                String(field.value ?? "")
              )}
              placeholder={
                provinces.loading
                  ? "Đang tải tỉnh/thành..."
                  : "Chọn tỉnh / thành"
              }
              value={String(field.value ?? "")}
            />
            {provinces.error ? (
              <div role="alert" className="text-sm text-destructive">
                {provinces.error}{" "}
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setProvinceRetry((value) => value + 1)}
                >
                  Thử lại
                </Button>
              </div>
            ) : null}
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={wardName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phường / xã / đặc khu</FormLabel>
            <FormSelect
              disabled={!wardsReady || Boolean(wards.error)}
              inputRef={field.ref}
              name={field.name}
              onBlur={field.onBlur}
              onValueChange={field.onChange}
              options={withExistingValue(
                wardOptions,
                String(field.value ?? "")
              )}
              placeholder={
                !provinceCode
                  ? "Chọn tỉnh/thành trước"
                  : !wardsReady
                    ? "Đang tải phường/xã..."
                    : "Chọn phường / xã / đặc khu"
              }
              value={String(field.value ?? "")}
            />
            {wardsReady && wards.error ? (
              <div role="alert" className="text-sm text-destructive">
                {wards.error}{" "}
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setWardRetry((value) => value + 1)}
                >
                  Thử lại
                </Button>
              </div>
            ) : null}
            {wardsReady && !wards.error && wards.data.length === 0 ? (
              <p className="text-sm text-destructive" role="alert">
                Chưa có dữ liệu phường/xã cho tỉnh/thành này. Vui lòng thử lại
                sau.
              </p>
            ) : null}
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
