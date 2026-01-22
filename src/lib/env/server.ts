/**
 * Server-side environment configuration
 *
 * This module validates and exports server-side environment variables.
 * It uses the `server-only` package to prevent accidental imports from client code.
 *
 * Usage:
 *   import { env } from '@/lib/env/server'
 *   console.log(env.DATABASE_URL)
 *
 * Add new environment variables to the schema as the project grows.
 */
import "server-only";

import { z } from "zod";

/**
 * Server-side environment schema
 *
 * Add required environment variables here. Use z.string().optional() for optional vars.
 * The schema validates at import time, failing fast if required vars are missing.
 */
const serverEnvSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth (Better Auth)
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.url("BETTER_AUTH_URL must be a valid URL"),

  // OAuth providers (optional in development)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // --- Add inference provider keys here as needed ---
  // OPENAI_API_KEY: z.string().optional(),
  // ANTHROPIC_API_KEY: z.string().optional(),
  // OLLAMA_BASE_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Parse and validate server environment variables
 */
function parseServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "❌ Invalid server environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error("Invalid server environment configuration");
  }

  return parsed.data;
}

/**
 * Validated server environment variables
 *
 * Import this in server-side code only. Importing from client code will throw.
 */
export const env = parseServerEnv();
