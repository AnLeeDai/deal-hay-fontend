import Link from "next/link"
import { ArrowUpRightIcon, PackageCheckIcon } from "lucide-react"

import { MediaImage } from "@/components/media-image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"
import type { PublicProductSummary } from "@/types/catalog"

type ProductCardProps = {
  product: PublicProductSummary
  href: string
  eyebrow?: string
  showStock?: boolean
}

export function ProductCard({
  product,
  href,
  eyebrow,
  showStock = false,
}: ProductCardProps) {
  return (
    <Link href={href} className="group block min-w-0">
      <Card className="h-full gap-0 py-0 transition-all group-hover:-translate-y-1 group-hover:shadow-md">
        <div className="relative overflow-hidden">
          <MediaImage
            alt={product.name}
            className="aspect-square w-full"
            fallbackLabel="Chưa có ảnh sản phẩm"
            imageClassName="transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            src={product.image_url}
          />
          <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
            {product.label ? <Badge>{product.label}</Badge> : null}
            {product.stock === 0 ? (
              <Badge variant="destructive">Tạm hết hàng</Badge>
            ) : null}
          </div>
        </div>
        <CardContent className="flex-1 gap-2 p-3 sm:p-4">
          {eyebrow ? (
            <p className="truncate text-xs font-medium text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="line-clamp-2 min-h-10 leading-5 font-medium group-hover:text-primary">
            {product.name}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {product.category}
          </p>
          <p className="pt-1 text-base font-semibold text-primary sm:text-lg">
            {formatCurrency(product.price)}
          </p>
        </CardContent>
        <CardFooter className="justify-between gap-2 border-t px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
          <span className="flex min-w-0 items-center gap-1.5">
            <PackageCheckIcon className="size-3.5 shrink-0" />
            {showStock
              ? `Còn ${product.stock} sản phẩm`
              : product.stock > 0
                ? "Còn hàng"
                : "Hết hàng"}
          </span>
          <ArrowUpRightIcon className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </CardFooter>
      </Card>
    </Link>
  )
}
