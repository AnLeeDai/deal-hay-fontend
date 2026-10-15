export type ProductOption = {
  id?: string
  name: string
  values: string[]
}

export type ProductVariant = {
  id?: string
  sku?: string | null
  option_values: Record<string, string>
  price: number | null
  stock: number
  is_active: boolean
  is_default: boolean
  color?: string | null
  size?: string | null
}

export type PublicShop = {
  code: string
  name: string
  email: string
  phone_number: string
  owner_name?: string
  avatar_url: string | null
  address: string
  products_count: number
  followers_count: number
  likes_count: number
  dislikes_count: number
  reactions_count: number
  satisfaction_rate: number | null
  response_rate: number | null
  is_online: boolean
  last_activity_at: number | null
  viewer: {
    can_interact: boolean
    is_following: boolean
    reaction: "like" | "dislike" | null
  }
}

export type PublicProductVariant = ProductVariant & {
  id: string
  sku: string
  variant_label?: string | null
}

export type PublicProduct = {
  id: string
  slug: string
  sku: string | null
  name: string
  category: string
  description: string | null
  price: number
  display_price?: number
  stock: number
  has_variants: boolean
  label: string | null
  image_url: string | null
  images: Array<{ id: string; image_url: string }>
  options: ProductOption[]
  variants: PublicProductVariant[]
}

export type PublicProductSummary = Omit<
  PublicProduct,
  "description" | "images" | "options" | "variants"
>

export type ProductReview = {
  id: string
  reaction: "like" | "dislike"
  content: string
  image_url: string | null
  shop_reply: string | null
  replied_at: string | null
  created_at: string | null
  updated_at: string | null
  customer: {
    id: string
    name: string
    avatar_url: string | null
  }
  product?: {
    id: string
    slug: string
    name: string
    image_url: string | null
  }
}

export type ProductReviewSummary = {
  total_count: number
  likes_count: number
  dislikes_count: number
}

export type HomeProduct = PublicProductSummary & {
  shop: {
    code: string
    name: string
    avatar_url: string | null
  }
}

export type FeaturedShop = {
  code: string
  name: string
  avatar_url: string | null
  address: string
  products_count: number
}
