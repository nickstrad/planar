/**
 * Candidate Selection
 *
 * Implements routing strategies for selecting primary candidates
 * and building fallback chains.
 */

import { ResolvedProvider } from "../common";
import { getAliasMapping } from "./config";
import { sortByCost, filterByCostCap, estimateCost } from "./cost";
import {
  resolveAliasOrThrow,
  expandCandidates,
  applyHardConstraints,
  buildHardConstraints,
  getViableCandidates,
} from "./resolver";
import { FILTER_REASON, ROUTING_STRATEGY } from "./types";
import type {
  FilteredCandidate,
  RoutingInput,
  RoutingStrategy,
  RoutingPlanSnapshot,
  FallbackConfig,
  PolicyConstraintError,
  TenantRoutingPolicy,
} from "./types";

// =============================================================================
// Strategy Selection
// =============================================================================

/**
 * Select primary candidate using the cheapest strategy.
 * Sorts by total cost rate and selects the cheapest viable candidate.
 */
export function selectCheapest(
  candidates: FilteredCandidate[],
): FilteredCandidate | null {
  const viable = getViableCandidates(candidates);
  if (viable.length === 0) {
    return null;
  }

  const sorted = sortByCost(viable);
  return sorted[0];
}

/**
 * Select primary candidate using the quality strategy.
 * Sorts by context window (larger = more capable) and selects the best.
 */
export function selectQuality(
  candidates: FilteredCandidate[],
): FilteredCandidate | null {
  const viable = getViableCandidates(candidates);
  if (viable.length === 0) {
    return null;
  }

  // Sort by context window descending (larger = higher quality)
  const sorted = [...viable].sort((a, b) => {
    const diff = b.capabilities.contextWindow - a.capabilities.contextWindow;
    // If equal, prefer lower priority (higher in fallback order)
    if (diff === 0) {
      return a.priority - b.priority;
    }
    return diff;
  });

  return sorted[0];
}

/**
 * Select primary candidate using the pinned strategy.
 * Selects a specific provider + model if viable.
 */
export function selectPinned(
  candidates: FilteredCandidate[],
  providerId: string,
  modelId: string,
): FilteredCandidate | null {
  const match = candidates.find(
    (c) => c.providerId === providerId && c.modelId === modelId && !c.filtered,
  );

  return match ?? null;
}

/**
 * Select primary candidate based on strategy.
 */
export function selectPrimary(
  candidates: FilteredCandidate[],
  strategy: RoutingStrategy,
  pinnedProvider?: { providerId: string; modelId: string },
): FilteredCandidate | null {
  switch (strategy) {
    case ROUTING_STRATEGY.cheapest:
      return selectCheapest(candidates);

    case ROUTING_STRATEGY.quality:
      return selectQuality(candidates);

    case ROUTING_STRATEGY.pinned:
      if (!pinnedProvider) {
        // Fall back to cheapest if no pinned provider specified
        return selectCheapest(candidates);
      }
      return selectPinned(
        candidates,
        pinnedProvider.providerId,
        pinnedProvider.modelId,
      );
  }
}

// =============================================================================
// Fallback Chain Construction
// =============================================================================

/**
 * Build fallback chain from candidates after primary selection.
 *
 * @param candidates - All candidates
 * @param primary - The selected primary candidate
 * @param maxCandidates - Maximum fallback chain length
 * @returns Ordered fallback providers
 */
export function buildFallbackChain(
  candidates: FilteredCandidate[],
  primary: FilteredCandidate,
  maxCandidates: number,
): ResolvedProvider[] {
  // Get viable candidates excluding primary
  const viable = getViableCandidates(candidates).filter(
    (c) =>
      !(c.providerId === primary.providerId && c.modelId === primary.modelId),
  );

  // Sort by priority
  const sorted = [...viable].sort((a, b) => a.priority - b.priority);

  // Limit to maxCandidates
  const limited = sorted.slice(0, maxCandidates);

  // Convert to ResolvedProvider
  return limited.map((c) => ({
    providerId: c.providerId,
    modelId: c.modelId,
  }));
}

// =============================================================================
// Full Routing Flow
// =============================================================================

/**
 * Determine the effective strategy for a routing request.
 */
export function determineStrategy(
  input: RoutingInput,
  tenantPolicy: TenantRoutingPolicy | null,
): RoutingStrategy {
  // Precedence: explicit request > tenant policy > alias default > platform default

  // 1. Explicit request strategy
  if (input.strategy) {
    return input.strategy;
  }

  // 2. Tenant policy default
  if (tenantPolicy?.defaultStrategy) {
    return tenantPolicy.defaultStrategy;
  }

  // 3. Alias default strategy
  const aliasMapping = getAliasMapping(input.modelAlias);
  if (aliasMapping?.defaultStrategy) {
    return aliasMapping.defaultStrategy;
  }

  // 4. Platform default
  return ROUTING_STRATEGY.cheapest;
}

/**
 * Apply tenant policy constraints to candidates.
 */
export function applyTenantPolicy(
  candidates: FilteredCandidate[],
  policy: TenantRoutingPolicy | null,
): FilteredCandidate[] {
  if (!policy) {
    return candidates;
  }

  return candidates.map((candidate) => {
    if (candidate.filtered) {
      return candidate;
    }

    // Check denied providers (overrides allowed)
    if (
      policy.deniedProviders &&
      policy.deniedProviders.includes(candidate.providerId)
    ) {
      return {
        ...candidate,
        filtered: true,
        filterReason: FILTER_REASON.tenant_denied_provider,
      };
    }

    // Check allowed providers (if specified)
    if (
      policy.allowedProviders &&
      policy.allowedProviders.length > 0 &&
      !policy.allowedProviders.includes(candidate.providerId)
    ) {
      return {
        ...candidate,
        filtered: true,
        filterReason: FILTER_REASON.tenant_provider_not_allowed,
      };
    }

    return candidate;
  });
}

/**
 * Create a PolicyConstraintError.
 */
function createPolicyConstraintError(
  message: string,
  constraint: string,
  tenantId: string,
): PolicyConstraintError {
  return {
    kind: "policy_constraint",
    message,
    constraint,
    tenantId,
  };
}

/**
 * Generate a unique snapshot ID.
 */
function generateSnapshotId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `snap_${timestamp}_${random}`;
}

/**
 * Execute the full routing flow.
 *
 * @param input - Routing input
 * @param tenantPolicy - Optional tenant routing policy
 * @param fallbackConfig - Fallback configuration
 * @returns Routing plan snapshot
 * @throws AliasResolutionError if alias resolution fails
 * @throws PolicyConstraintError if constraints eliminate all candidates
 */
export function route(
  input: RoutingInput,
  tenantPolicy: TenantRoutingPolicy | null = null,
  fallbackConfig: FallbackConfig = {
    maxAttempts: 3,
    totalTimeoutMs: 120_000,
    maxCandidates: 3,
  },
): RoutingPlanSnapshot {
  // 1. Resolve alias to candidates
  const candidateRefs = resolveAliasOrThrow(input.modelAlias);

  // 2. Expand candidates with full metadata
  let candidates = expandCandidates(candidateRefs);

  // 3. Apply hard constraints
  const hardConstraints = buildHardConstraints(input);
  candidates = applyHardConstraints(candidates, hardConstraints);

  // 4. Apply tenant policy constraints
  candidates = applyTenantPolicy(candidates, tenantPolicy);

  // 5. Apply cost cap if specified
  const maxCost =
    input.constraints?.maxCostUsd ?? tenantPolicy?.maxCostPerRequestUsd;
  if (maxCost !== undefined) {
    candidates = filterByCostCap(
      candidates,
      maxCost,
      input.estimatedInputTokens,
      input.maxOutputTokens,
    );
  }

  // 6. Check if any viable candidates remain
  const viable = getViableCandidates(candidates);
  if (viable.length === 0) {
    throw createPolicyConstraintError(
      "All candidates eliminated by constraints",
      summarizeFilterReasons(candidates),
      input.tenantId,
    );
  }

  // 7. Determine strategy
  const strategy = determineStrategy(input, tenantPolicy);

  // 8. Select primary candidate
  const primary = selectPrimary(
    candidates,
    strategy,
    input.constraints?.pinnedProvider,
  );

  if (!primary) {
    throw createPolicyConstraintError(
      "No candidate matched selection criteria",
      `strategy:${strategy}`,
      input.tenantId,
    );
  }

  // 9. Build fallback chain
  const fallbacks = buildFallbackChain(
    candidates,
    primary,
    fallbackConfig.maxCandidates,
  );

  // 10. Estimate cost for primary
  const costEstimate = estimateCost(
    input.estimatedInputTokens,
    input.maxOutputTokens,
    primary.costRates,
    { providerId: primary.providerId, modelId: primary.modelId },
  );

  // 11. Build snapshot
  const snapshot: RoutingPlanSnapshot = {
    primary: {
      providerId: primary.providerId,
      modelId: primary.modelId,
    },
    fallbacks,
    snapshotId: generateSnapshotId(),
    strategy,
    resolvedAlias: input.modelAlias,
    candidateCount: candidates.length,
    timestamp: Date.now(),
    costEstimate,
    tenantId: input.tenantId,
  };

  return snapshot;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Summarize filter reasons for error messages.
 */
function summarizeFilterReasons(candidates: FilteredCandidate[]): string {
  const reasons = new Map<string, number>();

  for (const c of candidates) {
    if (c.filtered && c.filterReason) {
      reasons.set(c.filterReason, (reasons.get(c.filterReason) ?? 0) + 1);
    }
  }

  if (reasons.size === 0) {
    return "unknown";
  }

  return Array.from(reasons.entries())
    .map(([reason, count]) => `${reason}(${count})`)
    .join(", ");
}
