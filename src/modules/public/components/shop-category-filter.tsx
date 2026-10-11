"use client"

import { useMemo, useState } from "react"

import { EmptyState } from "@/components/layout/empty-state"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { ProductCard } from "@/modules/public/components/product-card"
import type { PublicProductSummary } from "@/types/catalog"

const allProductsLabel = "Tất cả sản phẩm"

export function ShopCategoryFilter({
  categories,
  products,
  shopUserCode,
}: {
  categories: string[]
  products: PublicProductSummary[]
  shopUserCode: string
}) {
  const [activeCategory, setActiveCategory] = useState(allProductsLabel)
  const filteredProducts = useMemo(
    () =>
      activeCategory === allProductsLabel
        ? products
        : products.filter((product) => product.category === activeCategory),
    [activeCategory, products]
  )

  return (
    <div className="space-y-6">
      <ScrollArea className="w-full">
        <div className="flex w-max gap-2 pb-3">
          {[allProductsLabel, ...categories].map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? "default" : "outline"}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            showStock
            eyebrow={product.label ?? "Sản phẩm đang kinh doanh"}
            href={`/shops/${shopUserCode}/products/${product.slug}`}
            product={product}
          />
        ))}
      </div>
      {filteredProducts.length === 0 ? (
        <EmptyState
          title="Danh mục chưa có sản phẩm"
          description="Hãy chọn danh mục khác hoặc quay lại sau khi cửa hàng cập nhật thêm sản phẩm."
        />
      ) : null}
    </div>
  )
}
