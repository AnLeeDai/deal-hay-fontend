export const notificationRoutes = {
  list: "/notifications",
  readAll: "/notifications/read-all",
  read: (notificationId: string) => `/notifications/${notificationId}/read`,
  tickets: "/tickets",
} as const
