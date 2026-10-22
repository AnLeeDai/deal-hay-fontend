import Link from "next/link"
import { redirect } from "next/navigation"

import { getShopManage } from "@/api/profile/queries"
import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShopOwnerUpgradeForm } from "@/modules/profile/components/shop-owner-upgrade-form"
import { CreateProductForm } from "@/modules/shop-management/components/create-product-form"
import type { User } from "@/types/auth"

export async function SellPageContainer({ user }: { user: User }) {
  if (user.role === "administrator") {
    redirect("/admin/shops")
  }

  if (user.role === "shop_owner") {
    const data = await getShopManage()

    return (
      <div className="space-y-8">
        <PageHeader
          title="Đăng sản phẩm bán hàng"
          description="Thêm ảnh, giá và thông tin sản phẩm để đăng bán trên cửa hàng của bạn."
          actions={
            <Link
              href="/shop-manage"
              className={buttonVariants({ variant: "outline" })}
            >
              Quản lý cửa hàng
            </Link>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>Thông tin sản phẩm</CardTitle>
            <CardDescription>
              Điền thông tin bên dưới để đăng sản phẩm mới.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateProductForm categories={data.categories ?? []} />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (user.role !== "customer") {
    redirect("/forbidden")
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Đăng ký bán hàng"
        description="Hoàn tất thông tin cửa hàng để đăng ký trở thành người bán."
      />
      <Card>
        <CardHeader>
          <CardTitle>Thông tin đăng ký người bán</CardTitle>
          <CardDescription>
            Yêu cầu sẽ được quản trị viên xem xét. Sau khi được duyệt, bạn có
            thể đăng sản phẩm và quản lý cửa hàng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShopOwnerUpgradeForm user={user} />
        </CardContent>
      </Card>
    </div>
  )
}
