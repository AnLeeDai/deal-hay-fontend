import { redirect } from "next/navigation"

import { getShopManage } from "@/api/profile/queries"
import { ShopManagementClient } from "@/modules/shop-management/components/shop-management-client"

export async function ShopManagementPageContainer({
  initialTab,
}: { initialTab?: string } = {}) {
  const data = await getShopManage()
  const user = data.auth?.user

  if (!user) {
    redirect("/sign-in")
  }

  return (
    <ShopManagementClient
      user={user}
      categories={data.categories ?? []}
      products={data.products ?? []}
      coupons={data.coupons ?? []}
      orders={data.orders ?? []}
      metrics={data.shopMetrics ?? data.metrics}
      inventoryMovements={data.inventoryMovements ?? []}
      productReviews={data.productReviews ?? []}
      initialTab={
        initialTab &&
        [
          "overview",
          "products",
          "inventory",
          "orders",
          "promotions",
          "reviews",
          "settings",
        ].includes(initialTab)
          ? initialTab
          : "overview"
      }
    />
  )
}
