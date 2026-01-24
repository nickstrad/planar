/**
 * Common Types
 *
 * Shared type definitions used across multiple projects.
 * Project A (Inference) and Project B (Routing) both import from here.
 */

import { z } from "zod";

// =============================================================================
// Provider & Routing Types
// =============================================================================

/**
 * Minimal provider info needed for routing and execution.
 */
export const ResolvedProviderSchema = z.object({
  /** Provider identifier (e.g., "openai", "ollama") */
  providerId: z.string().min(1),
  /** Model identifier for this provider (e.g., "gpt-4o", "llama3.2") */
  modelId: z.string().min(1),
});
export type ResolvedProvider = z.infer<typeof ResolvedProviderSchema>;

/**
 * Routing plan with primary provider and fallbacks.
 */
export const RoutingPlanSchema = z.object({
  /** Primary provider to use */
  primary: ResolvedProviderSchema,
  /** Fallback providers if primary fails (ordered) */
  fallbacks: z.array(ResolvedProviderSchema),
});
export type RoutingPlan = z.infer<typeof RoutingPlanSchema>;

// =============================================================================
// Provider Capabilities
// =============================================================================

/**
 * Provider capabilities reported by each adapter.
 */
export interface ProviderCapabilities {
  /** Whether provider supports streaming */
  supportsStreaming: boolean;

  /** Whether provider supports function/tool calls */
  supportsTools: boolean;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Normalized error kinds across all providers.
 * Used for consistent error handling and retry logic.
 */
export type ErrorKind =
  | "provider_error" // Provider returned an error
  | "rate_limit" // Rate limited by provider
  | "auth_error" // Authentication failed
  | "model_not_found" // Model doesn't exist
  | "context_length" // Input too long
  | "timeout" // Request timed out
  | "cancelled" // Request was cancelled
  | "network_error" // Network connectivity issue
  | "internal_error"; // Platform internal error

/**
 * Execution error with normalized structure.
 */
export interface ExecutionError {
  /** Normalized error kind */
  kind: ErrorKind;

  /** Human-readable message */
  message: string;

  /** Provider that produced the error */
  providerId: string;

  /** Original error from provider (for debugging) */
  providerError?: {
    code?: string;
    message?: string;
    status?: number;
  };
}

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Errors that can trigger a retry within the same provider.
 */
const RETRYABLE_ERROR_KINDS: ReadonlySet<ErrorKind> = new Set([
  "rate_limit",
  "network_error",
  "timeout",
]);

/**
 * Errors that can trigger fallback to next provider.
 * Superset of retryable errors plus some provider-specific failures.
 */
const FALLBACK_ERROR_KINDS: ReadonlySet<ErrorKind> = new Set([
  "rate_limit",
  "network_error",
  "timeout",
  "provider_error",
  "model_not_found",
]);

/**
 * Check if an error kind should trigger retry within the same provider.
 */
export function isRetryableError(error: ExecutionError): boolean {
  return RETRYABLE_ERROR_KINDS.has(error.kind);
}

/**
 * Check if an error kind should trigger fallback to next provider.
 */
export function shouldFallback(error: ExecutionError): boolean {
  return FALLBACK_ERROR_KINDS.has(error.kind);
}
