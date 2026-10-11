import "server-only"

import { z } from "zod"

const envSchema = z.object({
  NEXT_PUBLIC_API: z
    .string()
    .trim()
    .url()
    .transform((url) => url.replace(/\/+$/, "")),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
})

export const env = envSchema.parse({
  NEXT_PUBLIC_API: process.env.NEXT_PUBLIC_API,
  NODE_ENV: process.env.NODE_ENV,
})

export const isProduction = env.NODE_ENV === "production"
