"use client"

import { useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ImagePlusIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldPath,
} from "react-hook-form"
import { toast } from "sonner"

import { FormSelect } from "@/components/form-select"
import { FormSubmitButton } from "@/components/form-submit-button"
import { SelectedFilePreview } from "@/components/selected-file-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { applyServerErrors, runUploadAction } from "@/lib/form-utils"
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/validation"
import { prepareImageUploads } from "@/lib/image-upload"
import type { ShopCategory } from "@/types/shop"
import { createProductAction } from "@/modules/shop-management/actions"
import {
  buildProductVariants,
  productFormErrors,
  validateProductOptions,
  variantsMatchOptions,
} from "@/modules/shop-management/lib/product-variants"
import {
  createProductSchema,
  type CreateProductValues,
} from "@/modules/shop-management/schemas/shop-management"

function initialProductValues(categories: ShopCategory[]): CreateProductValues {
  return {
    name: "",
    category: categories[0]?.name ?? "",
    price: 1000,
    old_price: "",
    video_url: "",
    stock: 0,
    label: "",
    description: "",
    image: undefined as unknown as File,
    gallery_images: [],
    has_variants: false,
    options: [],
    variants: [],
  }
}

function numericValue(value: string): number {
  return value === "" ? Number.NaN : Number(value)
}

function optionalNumericValue(value: string): number | "" {
  return value === "" ? "" : Number(value)
}

function fieldErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  if ("message" in error && typeof error.message === "string")
    return error.message
  for (const [key, value] of Object.entries(error)) {
    if (key === "ref") continue
    const message = fieldErrorMessage(value)
    if (message) return message
  }
  return undefined
}

function arrayErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  if ("message" in error && typeof error.message === "string")
    return error.message
  return "root" in error ? fieldErrorMessage(error.root) : undefined
}

function variantLabel(values: Record<string, string>): string {
  return Object.values(values).filter(Boolean).join(" · ") || "Biến thể"
}

export function CreateProductForm({
  categories,
}: {
  categories: ShopCategory[]
}) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<CreateProductValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: initialProductValues(categories),
  })
  const optionFields = useFieldArray({
    control: form.control,
    name: "options",
  })
  const variantFields = useFieldArray({
    control: form.control,
    name: "variants",
  })
  const hasVariants = useWatch({
    control: form.control,
    name: "has_variants",
  })
  const variants = useWatch({ control: form.control, name: "variants" }) ?? []

  const options = useWatch({ control: form.control, name: "options" }) ?? []
  const catalog = validateProductOptions(options)
  const variantsNeedUpdate =
    hasVariants &&
    variants.length > 0 &&
    (!catalog.success ||
      !variantsMatchOptions(
        catalog.options,
        catalog.combinationCount,
        variants
      ))
  const optionsError = arrayErrorMessage(form.formState.errors.options)
  const variantsError = arrayErrorMessage(form.formState.errors.variants)

  const buildVariants = () => {
    form.clearErrors(["options", "variants"])
    const result = buildProductVariants(
      form.getValues("options"),
      form.getValues("variants")
    )
    if (!result.success) {
      result.issues.forEach((issue) => {
        form.setError(issue.path.join(".") as FieldPath<CreateProductValues>, {
          type: "manual",
          message: issue.message,
        })
      })
      return
    }

    result.options.forEach((option, index) => {
      form.setValue(`options.${index}.name`, option.name, { shouldDirty: true })
      form.setValue(`options.${index}.values`, option.values.join(", "), {
        shouldDirty: true,
      })
    })
    variantFields.replace(result.variants)
    toast.success(`Đã tạo ${result.variants.length} biến thể.`)
  }

  const setDefaultVariant = (selectedIndex: number) => {
    variantFields.fields.forEach((_, index) => {
      form.setValue(`variants.${index}.is_default`, index === selectedIndex, {
        shouldDirty: true,
      })
      if (index === selectedIndex) {
        form.setValue(`variants.${index}.is_active`, true, {
          shouldDirty: true,
        })
      }
    })
    void form.trigger("variants")
  }

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData()
    formData.set("name", values.name)
    formData.set("category", values.category)
    formData.set("price", String(values.price))
    formData.set("old_price", String(values.old_price ?? ""))
    formData.set("video_url", values.video_url ?? "")
    formData.set("stock", String(values.stock))
    formData.set("label", values.label ?? "")
    formData.set("description", values.description ?? "")
    formData.set("image", values.image)
    values.gallery_images.forEach((image) => {
      formData.append("gallery_images", image)
    })
    formData.set(
      "catalog",
      JSON.stringify({
        has_variants: values.has_variants,
        options: values.has_variants ? values.options : [],
        variants: values.has_variants ? values.variants : [],
      })
    )

    startTransition(async () => {
      const state = await runUploadAction(async () =>
        createProductAction(await prepareImageUploads(formData, "product"))
      )
      const hasFieldErrors = applyServerErrors(
        productFormErrors(state.errors),
        form.setError
      )

      if (state.success) {
        toast.success(state.message)
        form.reset(initialProductValues(categories))
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form className="space-y-6" noValidate onSubmit={onSubmit}>
        {categories.length === 0 ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Chưa có danh mục hoạt động. Vui lòng liên hệ quản trị viên trước khi
            đăng sản phẩm.
          </div>
        ) : null}

        <section className="space-y-4" aria-labelledby="product-basic-heading">
          <div>
            <h3 id="product-basic-heading" className="font-medium">
              Thông tin cơ bản
            </h3>
            <p className="text-sm text-muted-foreground">
              Tên, mã quản lý, danh mục và giá bán công khai.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Tên sản phẩm</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={255}
                      placeholder="Ví dụ: Điện thoại Galaxy S24 256GB"
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Danh mục</FormLabel>
                  <FormSelect
                    disabled={categories.length === 0}
                    inputRef={field.ref}
                    name={field.name}
                    options={categories.map((category) => ({
                      label: category.name,
                      value: category.name,
                    }))}
                    placeholder="Chọn danh mục"
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
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giá bán sản phẩm</FormLabel>
                  <FormControl>
                    <Input
                      min={1000}
                      inputMode="numeric"
                      type="number"
                      {...field}
                      value={Number.isFinite(field.value) ? field.value : ""}
                      onChange={(event) =>
                        field.onChange(numericValue(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="old_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giá gốc (tùy chọn)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      min={1000}
                      type="number"
                      placeholder="Để trống nếu không có giá gốc"
                      onChange={(event) =>
                        field.onChange(optionalNumericValue(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Giá gốc phải cao hơn giá bán. Quảng cáo và mã giảm giá do hệ
                    thống tự động quản lý.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="video_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL video sản phẩm (HTTPS)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="url"
                      placeholder="https://.../san-pham.mp4"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Nhãn nổi bật</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={80}
                      placeholder="Ví dụ: Hàng mới, Bán chạy"
                      type="text"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <Separator />

        <section className="space-y-4" aria-labelledby="product-images-heading">
          <div>
            <h3 id="product-images-heading" className="font-medium">
              Hình ảnh sản phẩm
            </h3>
            <p className="text-sm text-muted-foreground">
              Chọn một ảnh đại diện và tối đa 50 ảnh bổ sung. Tất cả ảnh đều có
              bản xem trước trước khi đăng.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="image"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>Ảnh đại diện</FormLabel>
                  {value instanceof File ? (
                    <SelectedFilePreview
                      file={value}
                      onRemove={() => onChange(undefined)}
                    />
                  ) : (
                    <FormControl>
                      <Input
                        accept={IMAGE_UPLOAD_ACCEPT}
                        name={field.name}
                        ref={field.ref}
                        type="file"
                        onBlur={field.onBlur}
                        onChange={(event) =>
                          onChange(event.target.files?.[0] ?? undefined)
                        }
                      />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gallery_images"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>Thư viện ảnh</FormLabel>
                  {value.length > 0 ? (
                    <div className="grid gap-2">
                      {value.map((file, index) => (
                        <SelectedFilePreview
                          key={`${file.name}-${file.lastModified}-${index}`}
                          compact
                          className="max-w-none"
                          file={file}
                          onRemove={() =>
                            onChange(
                              value.filter(
                                (_, fileIndex) => fileIndex !== index
                              )
                            )
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                  <FormControl>
                    <Input
                      multiple
                      accept={IMAGE_UPLOAD_ACCEPT}
                      name={field.name}
                      ref={field.ref}
                      type="file"
                      onBlur={field.onBlur}
                      onChange={(event) => {
                        const selected = Array.from(event.target.files ?? [])
                        onChange([...value, ...selected].slice(0, 50))
                        event.target.value = ""
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Đã chọn {value.length}/50 ảnh bổ sung. Mỗi ảnh tối đa 30 MB;
                    tổng dung lượng ảnh sản phẩm tối đa 32 MB.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <Separator />

        <section className="space-y-4" aria-labelledby="product-detail-heading">
          <div>
            <h3 id="product-detail-heading" className="font-medium">
              Mô tả sản phẩm
            </h3>
            <p className="text-sm text-muted-foreground">
              Nêu rõ tình trạng, thông số, phụ kiện và chính sách liên quan.
            </p>
          </div>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nội dung mô tả</FormLabel>
                <FormControl>
                  <Textarea
                    className="min-h-32"
                    placeholder="Mô tả chi tiết để khách hàng hiểu rõ sản phẩm..."
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <Separator />

        <section className="space-y-4" aria-labelledby="product-stock-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 id="product-stock-heading" className="font-medium">
                Tồn kho và biến thể
              </h3>
              <p className="text-sm text-muted-foreground">
                Dùng biến thể khi sản phẩm có nhiều màu, kích thước hoặc phiên
                bản. SKU sản phẩm và SKU biến thể được hệ thống tự động tạo.
              </p>
            </div>
            <FormField
              control={form.control}
              name="has_variants"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border px-3 py-2">
                  <FormLabel className="cursor-pointer">
                    Sản phẩm có biến thể
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onBlur={field.onBlur}
                      onCheckedChange={(checked) => {
                        field.onChange(checked)
                        form.clearErrors(["stock", "options", "variants"])
                        if (checked && optionFields.fields.length === 0) {
                          optionFields.append({ name: "", values: "" })
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {!hasVariants ? (
            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Tồn kho ban đầu</FormLabel>
                  <FormControl>
                    <Input
                      min={0}
                      inputMode="numeric"
                      type="number"
                      {...field}
                      value={Number.isFinite(field.value) ? field.value : ""}
                      onChange={(event) =>
                        field.onChange(numericValue(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <div className="space-y-5 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Thuộc tính</p>
                  <p className="text-sm text-muted-foreground">
                    Nhập các giá trị cách nhau bằng dấu phẩy.
                  </p>
                </div>
                <Button
                  disabled={optionFields.fields.length >= 3}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => optionFields.append({ name: "", values: "" })}
                >
                  <PlusIcon /> Thêm thuộc tính
                </Button>
              </div>

              <div className="space-y-3">
                {optionFields.fields.map((option, optionIndex) => (
                  <div
                    key={option.id}
                    className="grid gap-3 rounded-lg bg-muted/50 p-3 md:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)_auto] md:items-start"
                  >
                    <FormField
                      control={form.control}
                      name={`options.${optionIndex}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tên thuộc tính</FormLabel>
                          <FormControl>
                            <Input
                              maxLength={80}
                              placeholder="Màu sắc"
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
                      name={`options.${optionIndex}.values`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Các giá trị</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Đen, Trắng, Xanh"
                              type="text"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      aria-label={`Xoá thuộc tính ${optionIndex + 1}`}
                      className="md:mt-6"
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={() => optionFields.remove(optionIndex)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
              </div>
              {optionsError ? (
                <p className="text-sm text-destructive" role="alert">
                  {optionsError}
                </p>
              ) : null}

              <Button type="button" variant="secondary" onClick={buildVariants}>
                <RefreshCwIcon /> Tạo / cập nhật danh sách biến thể
              </Button>

              {variantsNeedUpdate ? (
                <p className="text-sm text-destructive" role="alert">
                  Thuộc tính đã thay đổi. Hãy tạo / cập nhật danh sách biến thể
                  trước khi đăng. Giá và tồn kho của các tổ hợp còn lại sẽ được
                  giữ.
                </p>
              ) : null}

              {variantFields.fields.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      Danh sách biến thể ({variantFields.fields.length})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Giá trống sẽ dùng giá bán chung.
                    </p>
                  </div>
                  {variantFields.fields.map((variant, variantIndex) => {
                    const current = variants[variantIndex] ?? variant
                    const variantErrors =
                      form.formState.errors.variants?.[variantIndex]
                    const optionValuesError = fieldErrorMessage(
                      variantErrors?.option_values
                    )
                    const defaultError = fieldErrorMessage(
                      variantErrors?.is_default
                    )
                    return (
                      <div
                        key={variant.id}
                        className="space-y-3 rounded-lg border bg-background p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium break-words">
                              {variantLabel(current.option_values)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {Object.entries(current.option_values)
                                .map(([name, value]) => `${name}: ${value}`)
                                .join(" • ")}
                            </p>
                          </div>
                          {current.is_default ? (
                            <Badge>Mặc định</Badge>
                          ) : (
                            <Button
                              size="sm"
                              type="button"
                              variant="outline"
                              onClick={() => setDefaultVariant(variantIndex)}
                            >
                              Đặt mặc định
                            </Button>
                          )}
                        </div>
                        {optionValuesError || defaultError ? (
                          <p className="text-sm text-destructive" role="alert">
                            {optionValuesError || defaultError}
                          </p>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <FormField
                            control={form.control}
                            name={`variants.${variantIndex}.price`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Giá riêng</FormLabel>
                                <FormControl>
                                  <Input
                                    min={1000}
                                    inputMode="numeric"
                                    placeholder="Dùng giá chung"
                                    type="number"
                                    {...field}
                                    value={field.value}
                                    onChange={(event) =>
                                      field.onChange(
                                        optionalNumericValue(event.target.value)
                                      )
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`variants.${variantIndex}.stock`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tồn kho</FormLabel>
                                <FormControl>
                                  <Input
                                    min={0}
                                    inputMode="numeric"
                                    type="number"
                                    {...field}
                                    value={
                                      Number.isFinite(field.value)
                                        ? field.value
                                        : ""
                                    }
                                    onChange={(event) =>
                                      field.onChange(
                                        numericValue(event.target.value)
                                      )
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`variants.${variantIndex}.is_active`}
                            render={({ field }) => (
                              <FormItem className="rounded-lg border px-3 py-2 sm:mt-6">
                                <div className="flex items-center justify-between gap-3">
                                  <FormLabel className="cursor-pointer">
                                    Đang bán
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      disabled={current.is_default}
                                      onBlur={field.onBlur}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </div>
                                {current.is_default ? (
                                  <FormDescription>
                                    Đổi biến thể mặc định trước khi ngừng bán.
                                  </FormDescription>
                                ) : null}
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  <ImagePlusIcon className="size-4 shrink-0" />
                  Nhập thuộc tính rồi tạo danh sách biến thể để khai báo giá và
                  tồn kho riêng. SKU sẽ được hệ thống tự động tạo.
                </div>
              )}
              {variantsError ? (
                <p className="text-sm text-destructive" role="alert">
                  {variantsError}
                </p>
              ) : null}
            </div>
          )}
        </section>

        <FormSubmitButton
          className="w-full sm:w-auto"
          disabled={categories.length === 0}
          idleText="Đăng sản phẩm"
          pending={isPending}
          pendingText="Đang đăng..."
        />
      </form>
    </Form>
  )
}
