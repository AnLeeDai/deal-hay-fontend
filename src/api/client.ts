import "server-only"

import { cookies } from "next/headers"

import { env } from "@/config/env"
import { AUTH_TOKEN_COOKIE } from "@/lib/cookies"
import type { ValidationErrors } from "@/types/common"

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type SearchValue = string | number | boolean | null | undefined

export type ApiRequestOptions = {
  method?: ApiMethod
  path: string
  searchParams?: Record<string, SearchValue>
  body?: BodyInit | Record<string, unknown> | undefined
  headers?: HeadersInit
  token?: string | null
  cache?: RequestCache
  next?: { revalidate?: number; tags?: string[] }
}

type ApiErrorPayload = {
  message?: string
  errors?: ValidationErrors
  [key: string]: unknown
}

export class ApiError extends Error {
  status: number
  errors?: ValidationErrors
  payload: ApiErrorPayload

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message ?? "Yêu cầu thất bại.")
    this.status = status
    this.errors = payload.errors
    this.payload = payload
  }
}

function toQueryString(searchParams?: Record<string, SearchValue>): string {
  if (!searchParams) return ""
  const query = new URLSearchParams()
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    query.set(key, String(value))
  })
  const result = query.toString()
  return result ? `?${result}` : ""
}

function isFormData(value: ApiRequestOptions["body"]): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData
}

async function resolveToken(token?: string | null): Promise<string | null> {
  if (token !== undefined) return token
  const store = await cookies()
  return store.get(AUTH_TOKEN_COOKIE)?.value ?? null
}

export async function apiFetch<T>({
  method = "GET",
  path,
  searchParams,
  body,
  headers,
  token,
  cache = "no-store",
  next,
}: ApiRequestOptions): Promise<T> {
  const resolvedToken = await resolveToken(token)
  const requestHeaders = new Headers(headers)
  const url = `${env.BACKEND_API_URL}${path}${toQueryString(searchParams)}`

  if (resolvedToken) {
    requestHeaders.set("Authorization", `Bearer ${resolvedToken}`)
  }

  let requestBody: BodyInit | undefined
  if (body !== undefined) {
    if (
      isFormData(body) ||
      typeof body === "string" ||
      body instanceof URLSearchParams ||
      body instanceof Blob
    ) {
      requestBody = body
    } else {
      requestHeaders.set("Content-Type", "application/json")
      requestBody = JSON.stringify(body)
    }
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
    cache,
    next,
  })

  const contentType = response.headers.get("content-type") ?? ""
  const isJson = contentType.includes("application/json")
  const payload = isJson
    ? ((await response.json()) as ApiErrorPayload)
    : undefined

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload ?? { message: response.statusText }
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (isJson) {
    return payload as T
  }

  return (await response.text()) as T
}
