/**
 * Routing Types & Contracts
 *
 * Core type definitions for the Model Router & Cost/Policy Engine (Project B).
 * These types extend Project A's inference types and define routing-specific contracts.
 */

import { z } from "zod";
import {
  ResolvedProviderSchema,
  RoutingPlanSchema,
  type ResolvedProvider,
  type RoutingPlan,
  type ExecutionError,
  type ProviderCapabilities,
} from "../common";

// Re-export common types for convenience
export type {
  ResolvedProvider,
  RoutingPlan,
  ExecutionError,
  ProviderCapabilities,
};

// =============================================================================
// B1.1 Routing Input Context
// =============================================================================

/**
 * Routing strategy enum-like object.
 * Note: 'fastest' is deferred — requires latency history infrastructure.
 */
export const ROUTING_STRATEGY = {
  cheapest: "cheapest",
  quality: "quality",
  pinned: "pinned",
} as const;

// Tuple for z.enum (avoids circular reference with Object.values)
export const RoutingStrategySchema = z.enum(Object.values(ROUTING_STRATEGY));
export type RoutingStrategy = z.infer<typeof RoutingStrategySchema>;

/**
 * Constraints that filter or rank candidates during routing.
 */
export interface RoutingConstraints {
  /** Maximum context length requirement */
  maxContextLength?: number;

  /** Region allowlist (empty = allow all) */
  regionAllowlist?: string[];

  /** Vendor/provider allowlist (empty = allow all) */
  vendorAllowlist?: string[];

  /** Maximum cost per request in USD */
  maxCostUsd?: number;

  /** Explicit provider + model for pinned strategy */
  pinnedProvider?: {
    providerId: string;
    modelId: string;
  };
}

/**
 * Input to the routing system.
 * Contains all context needed to make a routing decision.
 */
export interface RoutingInput {
  /** Tenant making the request */
  tenantId: string;

  /** Model alias to resolve (e.g., "gpt-4", "claude-sonnet") */
  modelAlias: string;

  /** Whether streaming is required */
  streamRequired: boolean;

  /** Estimated input token count for context length checks */
  estimatedInputTokens: number;

  /** Maximum tokens to generate (for cost estimation) */
  maxOutputTokens?: number;

  /** Optional constraints on routing */
  constraints?: RoutingConstraints;

  /** Optional strategy override */
  strategy?: RoutingStrategy;
}

// =============================================================================
// B1.2 Model Catalog Configuration
// =============================================================================

/**
 * Cost rates for a model.
 */
export interface CostRates {
  /** Cost per 1,000 input tokens in USD */
  inputPer1kTokens: number;

  /** Cost per 1,000 output tokens in USD */
  outputPer1kTokens: number;

  /** Source of cost data */
  source: "config" | "api";

  /** Unix timestamp of last update */
  lastUpdated: number;
}

/**
 * Model catalog entry with provider, capabilities, and cost info.
 */
export interface ModelCatalogEntry {
  /** Provider identifier (e.g., "openai", "anthropic") */
  providerId: string;

  /** Model identifier (e.g., "gpt-4o", "claude-3-5-sonnet") */
  modelId: string;

  /** Human-readable display name */
  displayName: string;

  /** Maximum context window in tokens */
  contextWindow: number;

  /** Whether model supports streaming */
  supportsStreaming: boolean;

  /** Whether model supports tool/function calls */
  supportsTools: boolean;

  /** Cost rates for this model */
  costRates: CostRates;

  /** Whether this model is enabled for routing */
  enabled: boolean;

  /** Optional region constraint */
  region?: string;
}

/**
 * Reference to a candidate model in an alias mapping.
 */
export interface CandidateRef {
  /** Provider identifier */
  providerId: string;

  /** Model identifier */
  modelId: string;

  /** Priority in fallback chain (lower = higher priority) */
  priority: number;
}

/**
 * Mapping from an alias to candidate models.
 */
export interface ModelAliasMapping {
  /** The alias name (e.g., "gpt-4", "claude-sonnet") */
  alias: string;

  /** Candidate models for this alias */
  candidates: CandidateRef[];

  /** Default routing strategy for this alias */
  defaultStrategy: RoutingStrategy;

  /** Whether this alias is enabled */
  enabled: boolean;
}

// =============================================================================
// B1.3 Provider Capabilities (extends Project A)
// =============================================================================

/**
 * Model-level capabilities, extending Project A's ProviderCapabilities.
 */
export interface ModelCapabilities extends ProviderCapabilities {
  /** Provider identifier */
  providerId: string;

  /** Model identifier */
  modelId: string;

  /** Context window size */
  contextWindow: number;
}

// =============================================================================
// B2.1 Alias Resolution
// =============================================================================

/**
 * Alias resolution error kinds with messages.
 */
export const ALIAS_RESOLUTION_ERRORS = {
  unknown_alias: "Unknown model alias",
  disabled_alias: "Model alias is disabled",
  no_candidates: "No enabled candidates for alias",
} as const;

export type AliasResolutionErrorKind = keyof typeof ALIAS_RESOLUTION_ERRORS;

/**
 * Error during alias resolution.
 */
export interface AliasResolutionError {
  kind: AliasResolutionErrorKind;
  alias: string;
  message: string;
}

/**
 * Type guard for AliasResolutionError.
 */
export function isAliasResolutionError(
  error: unknown,
): error is AliasResolutionError {
  return (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    typeof (error as AliasResolutionError).kind === "string" &&
    (error as AliasResolutionError).kind in ALIAS_RESOLUTION_ERRORS
  );
}

// =============================================================================
// B2.2 Candidate Filtering
// =============================================================================

/**
 * Filter reason enum-like object.
 * Use these values instead of hardcoded strings.
 */
export const FILTER_REASON = {
  model_not_found: "model_not_found",
  no_streaming: "no_streaming",
  context_too_small: "context_too_small",
  vendor_not_allowed: "vendor_not_allowed",
  region_not_allowed: "region_not_allowed",
  provider_denied: "provider_denied",
  cost_exceeded: "cost_exceeded",
  tenant_denied_provider: "tenant_denied_provider",
  tenant_provider_not_allowed: "tenant_provider_not_allowed",
} as const;

export type FilterReason = (typeof FILTER_REASON)[keyof typeof FILTER_REASON];

/**
 * Human-readable descriptions for filter reasons.
 */
export const FILTER_REASON_DESCRIPTIONS: Record<FilterReason, string> = {
  model_not_found: "Model not found in catalog",
  no_streaming: "Model does not support streaming",
  context_too_small: "Model context window too small",
  vendor_not_allowed: "Vendor not in allowlist",
  region_not_allowed: "Region not in allowlist",
  provider_denied: "Provider in deny list",
  cost_exceeded: "Cost exceeds maximum",
  tenant_denied_provider: "Provider denied by tenant policy",
  tenant_provider_not_allowed: "Provider not in tenant allowlist",
};

/**
 * Allowlist constraint for filtering candidates.
 */
export interface AllowlistConstraint {
  type: "region" | "vendor";
  allowed: string[];
}

/**
 * Candidate with filtering metadata.
 */
export interface FilteredCandidate {
  /** Provider identifier */
  providerId: string;

  /** Model identifier */
  modelId: string;

  /** Model capabilities */
  capabilities: ModelCapabilities;

  /** Cost rates */
  costRates: CostRates;

  /** Whether this candidate was filtered out */
  filtered: boolean;

  /** Reason for filtering (if filtered) */
  filterReason?: FilterReason;

  /** Priority from alias mapping */
  priority: number;
}

// =============================================================================
// B3.1 Fallback Configuration
// =============================================================================

/**
 * Configuration for fallback behavior.
 */
export interface FallbackConfig {
  /** Maximum number of fallback attempts */
  maxAttempts: number;

  /** Total timeout for all attempts in milliseconds */
  totalTimeoutMs: number;

  /** Maximum candidates in fallback chain */
  maxCandidates: number;
}

/**
 * Default fallback configuration.
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  maxAttempts: 3,
  totalTimeoutMs: 120_000,
  maxCandidates: 3,
};

/**
 * Error when fallback chain is exhausted.
 */
export interface FallbackExhaustedError {
  kind: "fallback_exhausted";
  attemptedProviders: ResolvedProvider[];
  lastError: ExecutionError;
  message: string;
}

/**
 * Type guard for FallbackExhaustedError.
 */
export function isFallbackExhaustedError(
  error: unknown,
): error is FallbackExhaustedError {
  return (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as FallbackExhaustedError).kind === "fallback_exhausted"
  );
}

/**
 * Record of a single fallback attempt.
 */
export interface FallbackRecord {
  /** Attempt number (1-indexed) */
  attemptNumber: number;

  /** Provider that was attempted */
  provider: ResolvedProvider;

  /** Error that triggered fallback */
  error: ExecutionError;

  /** Unix timestamp of attempt */
  timestamp: number;
}

// =============================================================================
// B4.1 Cost Estimation (moved before B3.2 for schema dependency ordering)
// =============================================================================

/**
 * Pre-inference cost estimate.
 */
export const CostEstimateSchema = z.object({
  /** Number of input tokens */
  inputTokens: z.number().int().nonnegative(),
  /** Estimated output tokens */
  estimatedOutputTokens: z.number().int().nonnegative(),
  /** Cost for input tokens in USD */
  inputCostUsd: z.number().nonnegative(),
  /** Estimated cost for output tokens in USD */
  estimatedOutputCostUsd: z.number().nonnegative(),
  /** Total estimated cost in USD */
  totalEstimateUsd: z.number().nonnegative(),
  /** Provider this estimate is for */
  provider: ResolvedProviderSchema,
});
export type CostEstimate = z.infer<typeof CostEstimateSchema>;

/**
 * Post-inference actual cost.
 */
export const ActualCostSchema = z.object({
  /** Actual input tokens used */
  inputTokens: z.number().int().nonnegative(),
  /** Actual output tokens generated */
  outputTokens: z.number().int().nonnegative(),
  /** Actual cost for input tokens in USD */
  inputCostUsd: z.number().nonnegative(),
  /** Actual cost for output tokens in USD */
  outputCostUsd: z.number().nonnegative(),
  /** Total actual cost in USD */
  totalCostUsd: z.number().nonnegative(),
  /** Provider used */
  provider: ResolvedProviderSchema,
});
export type ActualCost = z.infer<typeof ActualCostSchema>;

// =============================================================================
// B3.2 Routing Plan Snapshot (extends Project A)
// =============================================================================

/**
 * Extended routing plan with metadata for recording/replay.
 */
export const RoutingPlanSnapshotSchema = RoutingPlanSchema.extend({
  /** Unique snapshot identifier */
  snapshotId: z.string().min(1),
  /** Strategy used for selection */
  strategy: RoutingStrategySchema,
  /** Original alias that was resolved */
  resolvedAlias: z.string().min(1),
  /** Number of candidates considered */
  candidateCount: z.number().int().nonnegative(),
  /** Unix timestamp of routing decision */
  timestamp: z.number().int().positive(),
  /** Pre-inference cost estimate */
  costEstimate: CostEstimateSchema,
  /** Tenant that made the request */
  tenantId: z.string().min(1),
});
export type RoutingPlanSnapshot = z.infer<typeof RoutingPlanSnapshotSchema>;

// =============================================================================
// B3.3 Tenant Routing Policy
// =============================================================================

/**
 * Per-tenant routing policy.
 */
export interface TenantRoutingPolicy {
  /** Tenant identifier */
  tenantId: string;

  /** Providers allowed for this tenant (empty = allow all) */
  allowedProviders?: string[];

  /** Providers denied for this tenant (overrides allowed) */
  deniedProviders?: string[];

  /** Soft preference for a specific provider */
  preferredProvider?: string;

  /** Maximum cost per request in USD */
  maxCostPerRequestUsd?: number;

  /** Default routing strategy */
  defaultStrategy?: RoutingStrategy;
}

// =============================================================================
// B4.2 Policy Constraints
// =============================================================================

/**
 * Hard constraints that eliminate candidates (binary pass/fail).
 */
export interface HardConstraints {
  /** Maximum context length required */
  maxContextLength?: number;

  /** Whether streaming is required */
  streamingRequired: boolean;

  /** Region allowlist */
  regionAllowlist?: string[];

  /** Vendor/provider allowlist */
  vendorAllowlist?: string[];
}

/**
 * Soft constraints that rank candidates (applied during selection).
 */
export interface SoftConstraints {
  /** Preferred routing strategy */
  preferredStrategy: RoutingStrategy;

  /** Maximum cost in USD (soft cap) */
  maxCostUsd?: number;

  /** Preferred provider (soft preference) */
  preferredProvider?: string;
}

/**
 * Constraint precedence levels.
 * Precedence: explicit request > tenant policy > platform default
 */
export type ConstraintSource = "request" | "tenant" | "platform";

/**
 * Error when policy constraints eliminate all candidates.
 */
export interface PolicyConstraintError {
  kind: "policy_constraint";
  message: string;
  constraint: string;
  tenantId: string;
}

/**
 * Type guard for PolicyConstraintError.
 */
export function isPolicyConstraintError(
  error: unknown,
): error is PolicyConstraintError {
  return (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as PolicyConstraintError).kind === "policy_constraint"
  );
}

// =============================================================================
// Routing Result Types
// =============================================================================

/**
 * Result of a successful routing decision.
 */
export interface RoutingResult {
  /** The routing plan snapshot */
  snapshot: RoutingPlanSnapshot;

  /** Filtered candidates (for debugging/telemetry) */
  candidates: FilteredCandidate[];
}

/**
 * Union of all routing errors.
 */
export type RoutingError =
  | AliasResolutionError
  | FallbackExhaustedError
  | PolicyConstraintError;

/**
 * Type guard for any routing error.
 */
export function isRoutingError(error: unknown): error is RoutingError {
  return (
    isAliasResolutionError(error) ||
    isFallbackExhaustedError(error) ||
    isPolicyConstraintError(error)
  );
}
