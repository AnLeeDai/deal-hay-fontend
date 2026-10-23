import type { ValidationErrors } from "@/types/common"

export class LiveApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: ValidationErrors
  ) {
    super(message)
  }
}

export async function liveApiFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH"
    body?: FormData | Record<string, unknown>
    headers?: HeadersInit
    searchParams?: Record<string, string | number | undefined>
  } = {}
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set("Accept", "application/json")
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined) query.set(key, String(value))
  }
  const body =
    options.body instanceof FormData
      ? options.body
      : options.body
        ? JSON.stringify(options.body)
        : undefined
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json")
  const response = await fetch(
    `/api/live${path}${query.size ? `?${query}` : ""}`,
    {
      method: options.method ?? "GET",
      headers,
      body,
      cache: "no-store",
      credentials: "same-origin",
    }
  )
  const payload = await response.json()
  if (!response.ok)
    throw new LiveApiError(
      response.status,
      payload.message ?? "Yêu cầu thất bại.",
      payload.errors
    )
  return payload as T
}
