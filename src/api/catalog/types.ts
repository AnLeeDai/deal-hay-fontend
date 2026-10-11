import type {
  FeaturedShop,
  HomeProduct,
  ProductReview,
  ProductReviewSummary,
  PublicProduct,
  PublicProductSummary,
  PublicShop,
} from "@/types/catalog"
import type { PaginatedResponse } from "@/types/common"

export type HomeResponse = {
  featuredShops: FeaturedShop[]
  products: PaginatedResponse<HomeProduct> & {
    current_page: number
    last_page: number
  }
  categories: string[]
  filters: { category: string }
}

export type ShopResponse = {
  shop: PublicShop
  products: PublicProductSummary[]
  categories: string[]
  metrics?: Record<string, unknown>
  viewerState?: Record<string, unknown>
}

export type ProductResponse = {
  shop: PublicShop
  product: PublicProduct
  relatedProducts: PublicProductSummary[]
  reviews: ProductReview[]
  reviewSummary: ProductReviewSummary
}
