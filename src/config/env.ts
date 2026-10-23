import "server-only"

import { z } from "zod"

const envSchema = z.object({
  BACKEND_API_URL: z
    .string()
    .trim()
    .url()
    .refine((value) => {
      const url = new URL(value)
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      )
    }, "Backend API URL must be an HTTP(S) URL without credentials, query or fragment.")
    .transform((url) => url.replace(/\/+$/, "")),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
})

export const env = envSchema.parse({
  BACKEND_API_URL:
    process.env.BACKEND_API_URL?.trim() || process.env.NEXT_PUBLIC_API,
  NODE_ENV: process.env.NODE_ENV,
})

export const isProduction = env.NODE_ENV === "production"
