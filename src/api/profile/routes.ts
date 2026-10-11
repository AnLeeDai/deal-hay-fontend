export const profileRoutes = {
  me: "/private/profile/me",
  updateMe: "/private/profile/me",
  updatePassword: "/private/me/password",
  avatar: "/private/me/avatar",
  shopManage: "/private/shop/manage",
  updateShop: "/private/shop/manage",
  shopAvatar: "/private/shop/avatar",
  shopProducts: "/private/shop/products",
  shopProduct: (productId: string) => `/private/shop/products/${productId}`,
  shopProductStatus: (productId: string) =>
    `/private/shop/products/${productId}/status`,
  shopProductInventory: (productId: string) =>
    `/private/shop/products/${productId}/inventory`,
  shopCoupons: "/private/shop/coupons",
  shopCoupon: (couponId: string) => `/private/shop/coupons/${couponId}`,
  shopOrdersStatus: (orderId: string) =>
    `/private/shop/orders/${orderId}/status`,
  shopCategoriesReorder: "/private/shop/categories/reorder",
  shopOwnerUpgrade: "/shop-owner-upgrade-requests",
} as const
