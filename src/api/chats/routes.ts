export const chatRoutes = {
  list: "/messages",
  detail: (conversationSlug: string) => `/messages/${conversationSlug}`,
  history: (conversationSlug: string) =>
    `/messages/${conversationSlug}/history`,
  send: (conversationSlug: string) => `/messages/${conversationSlug}`,
  read: (conversationSlug: string) => `/messages/${conversationSlug}/read`,
  presence: "/presence/heartbeat",
  realtimeConfig: "/realtime/config",
} as const
