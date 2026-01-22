/**
 * Environment configuration module
 *
 * Server-side env: import { env } from '@/lib/env/server'
 *
 * Note: There is no client-side env export. Client code should only access
 * NEXT_PUBLIC_* variables directly via process.env.NEXT_PUBLIC_*.
 * This prevents accidental exposure of secrets.
 */

// Re-export server env for convenience (still enforces server-only)
export { env } from "./server";
export type { ServerEnv } from "./server";
