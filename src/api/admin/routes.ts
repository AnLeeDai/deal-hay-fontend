export const adminRoutes = {
  users: "/admin/users",
  toggleUserLock: (userId: string) => `/admin/users/${userId}/toggle-lock`,
  startChat: (userId: string) => `/admin/users/${userId}/chat`,
  shops: "/admin/shops",
  shop: (shopId: string) => `/admin/shops/${shopId}`,
  shopProduct: (shopId: string, productId: string) =>
    `/admin/shops/${shopId}/products/${productId}`,
  categories: "/admin/categories",
  category: (categoryId: string) => `/admin/categories/${categoryId}`,
  tickets: "/admin/tickets",
  ticket: (ticketId: string) => `/admin/tickets/${ticketId}`,
} as const
