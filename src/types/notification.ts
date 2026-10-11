export type AppNotification = {
  id: string
  title: string
  body: string
  category: string
  user_id?: string | null
  ticket_id: string | null
  action_url: string | null
  data: Record<string, unknown>
  read_at: string | null
  created_at: string | null
}
