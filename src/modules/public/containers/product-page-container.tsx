import Link from "next/link"
import { notFound } from "next/navigation"
import {
  MessageSquareTextIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react"

import { ApiError } from "@/api/client"
import { getProduct } from "@/api/catalog/queries"
import { ImagePreview } from "@/components/image-preview"
import { EmptyState } from "@/components/layout/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { UserAvatar } from "@/components/user-avatar"
import { formatDate } from "@/lib/format"
import { ProductCard } from "@/modules/public/components/product-card"
import { ProductGallery } from "@/modules/public/components/product-gallery"
import { ProductInteractions } from "@/modules/public/components/product-interactions"

export async function ProductPageContainer({
  shopUserCode,
  productSlug,
}: {
  shopUserCode: string
  productSlug: string
}) {
  let data

  try {
    data = await getProduct(shopUserCode, productSlug)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

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
            <BreadcrumbLink render={<Link href={`/shops/${shopUserCode}`} />}>
              {data.shop.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-52 truncate">
              {data.product.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-start">
        <ProductGallery
          imageUrl={data.product.image_url}
          images={data.product.images}
          name={data.product.name}
        />
        <ProductInteractions shop={data.shop} product={data.product} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Mô tả sản phẩm</CardTitle>
            <CardDescription>
              Thông tin chi tiết do cửa hàng cung cấp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="leading-7 whitespace-pre-wrap text-muted-foreground">
              {data.product.description ||
                "Cửa hàng chưa bổ sung mô tả chi tiết cho sản phẩm này."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Đánh giá tổng quan</CardTitle>
            <CardDescription>
              {data.reviewSummary.total_count} lượt đánh giá đã xác thực
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-secondary p-4 text-center">
                <ThumbsUpIcon className="mx-auto mb-2 size-5 text-primary" />
                <p className="text-2xl font-semibold">
                  {data.reviewSummary.likes_count}
                </p>
                <p className="text-xs text-muted-foreground">Hài lòng</p>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <ThumbsDownIcon className="mx-auto mb-2 size-5 text-muted-foreground" />
                <p className="text-2xl font-semibold">
                  {data.reviewSummary.dislikes_count}
                </p>
                <p className="text-xs text-muted-foreground">Chưa hài lòng</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-5" aria-labelledby="reviews-heading">
        <div>
          <p className="mb-1 text-sm font-medium text-primary">
            Ý kiến người mua
          </p>
          <h2
            id="reviews-heading"
            className="font-heading text-2xl font-semibold"
          >
            Đánh giá sản phẩm
          </h2>
        </div>
        {data.reviews.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {data.reviews.map((review) => (
              <Card key={review.id} size="sm">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={review.customer.name}
                      src={review.customer.avatar_url}
                    />
                    <div>
                      <CardTitle>{review.customer.name}</CardTitle>
                      <CardDescription>
                        {formatDate(review.created_at)}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={
                      review.reaction === "like" ? "secondary" : "outline"
                    }
                  >
                    {review.reaction === "like" ? (
                      <ThumbsUpIcon />
                    ) : (
                      <ThumbsDownIcon />
                    )}
                    {review.reaction === "like" ? "Hài lòng" : "Chưa hài lòng"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="leading-6">{review.content}</p>
                  {review.image_url ? (
                    <ImagePreview
                      alt={`Ảnh đánh giá của ${review.customer.name}`}
                      className="mt-2 w-full rounded-lg"
                      fallbackLabel="Không thể tải ảnh đánh giá"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      src={review.image_url}
                      thumbnailClassName="aspect-video w-full rounded-lg"
                    />
                  ) : null}
                  {review.shop_reply ? (
                    <>
                      <Separator />
                      <div className="rounded-lg bg-muted p-3">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary">
                          <MessageSquareTextIcon className="size-3.5" /> Phản
                          hồi từ cửa hàng
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {review.shop_reply}
                        </p>
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Chưa có đánh giá"
            description="Hãy là người đầu tiên chia sẻ trải nghiệm về sản phẩm này."
          />
        )}
      </section>

      {data.relatedProducts.length > 0 ? (
        <section className="space-y-5">
          <div>
            <p className="mb-1 text-sm font-medium text-primary">
              Có thể bạn sẽ thích
            </p>
            <h2 className="font-heading text-2xl font-semibold">
              Sản phẩm liên quan
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {data.relatedProducts.map((product) => (
              <ProductCard
                key={product.id}
                href={`/shops/${shopUserCode}/products/${product.slug}`}
                product={product}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
