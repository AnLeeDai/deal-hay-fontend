import "server-only"

import { z } from "zod"

const envSchema = z.object({
  BACKEND_API_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
})

export const env = envSchema.parse({
  BACKEND_API_URL: process.env.BACKEND_API_URL,
  NODE_ENV: process.env.NODE_ENV,
})

export const isProduction = env.NODE_ENV === "production"
