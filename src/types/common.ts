export type PaginationLink = {
  url: string | null
  label: string
  active: boolean
  page?: number | null
}

export type PaginatedResponse<T> = {
  data: T[]
  current_page?: number
  from: number | null
  to: number | null
  total: number
  last_page?: number
  links: PaginationLink[]
}

export type ApiMessageResponse<T = undefined> = T extends undefined
  ? { message: string }
  : { message: string; data: T }

export type ValidationErrors = Record<string, string[]>
