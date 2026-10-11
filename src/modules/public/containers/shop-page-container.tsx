import Link from "next/link"
import { notFound } from "next/navigation"
import {
  BadgeCheckIcon,
  HeartIcon,
  MailIcon,
  MapPinIcon,
  PackageIcon,
  PhoneIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react"

import { ApiError } from "@/api/client"
import { getShop } from "@/api/catalog/queries"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { UserAvatar } from "@/components/user-avatar"
import { ShopCategoryFilter } from "@/modules/public/components/shop-category-filter"

export async function ShopPageContainer({
  shopUserCode,
  category,
  page,
}: {
  shopUserCode: string
  category?: string
  page?: string
}) {
  let data

  try {
    data = await getShop(shopUserCode, category, page)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  const shopStats = [
    { icon: PackageIcon, value: data.shop.products_count, label: "Sản phẩm" },
    {
      icon: UsersIcon,
      value: data.shop.followers_count,
      label: "Người theo dõi",
    },
    { icon: HeartIcon, value: data.shop.likes_count, label: "Lượt yêu thích" },
    {
      icon: StarIcon,
      value:
        data.shop.satisfaction_rate === null
          ? "—"
          : `${data.shop.satisfaction_rate}%`,
      label: "Hài lòng",
    },
  ]

  return (
    <div className="space-y-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>
              Trang chủ
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{data.shop.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card className="overflow-hidden border-0 bg-foreground py-0 text-background ring-0">
        <div className="h-24 bg-linear-to-r from-primary/80 via-primary/40 to-transparent sm:h-32" />
        <CardContent className="-mt-8 gap-6 px-5 pb-7 sm:-mt-10 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <UserAvatar
                className="size-20 border-4 border-foreground bg-card shadow-lg sm:size-24"
                name={data.shop.name}
                size="lg"
                src={data.shop.avatar_url}
              />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-2xl font-semibold sm:text-3xl">
                    {data.shop.name}
                  </h1>
                  <BadgeCheckIcon className="size-5 text-primary" />
                  <Badge
                    className="border-background/20 bg-background/10 text-background"
                    variant="outline"
                  >
                    <span
                      className={
                        data.shop.is_online
                          ? "size-1.5 rounded-full bg-emerald-400"
                          : "size-1.5 rounded-full bg-background/40"
                      }
                    />
                    {data.shop.is_online ? "Đang hoạt động" : "Ngoại tuyến"}
                  </Badge>
                </div>
                <p className="mt-1 flex items-start gap-1.5 text-sm text-background/65">
                  <MapPinIcon className="mt-0.5 size-4 shrink-0" />{" "}
                  {data.shop.address || "Cửa hàng chưa cập nhật địa chỉ."}
                </p>
              </div>
            </div>
          </div>

          <Separator className="bg-background/10" />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {shopStats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-xl border border-background/10 bg-background/5 p-3"
              >
                <stat.icon className="size-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold">{stat.value}</p>
                  <p className="text-xs text-background/55">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 text-sm text-background/65 sm:flex-row sm:gap-6">
            <a
              className="flex items-center gap-2 hover:text-primary"
              href={`mailto:${data.shop.email}`}
            >
              <MailIcon className="size-4" />
              {data.shop.email}
            </a>
            <a
              className="flex items-center gap-2 hover:text-primary"
              href={`tel:${data.shop.phone_number}`}
            >
              <PhoneIcon className="size-4" />
              {data.shop.phone_number}
            </a>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-5">
        <div>
          <p className="mb-1 text-sm font-medium text-primary">
            Danh mục cửa hàng
          </p>
          <h2 className="font-heading text-2xl font-semibold">
            Sản phẩm đang bán
          </h2>
        </div>
        <ShopCategoryFilter
          categories={data.categories}
          products={data.products}
          shopUserCode={shopUserCode}
        />
      </section>
    </div>
  )
}
