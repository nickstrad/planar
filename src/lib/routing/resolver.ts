/**
 * Alias Resolution
 *
 * Resolves model aliases to candidate lists and handles
 * alias validation and error cases.
 */

import { getAliasMapping, getModelEntry } from "./config";
import {
  ALIAS_RESOLUTION_ERRORS,
  FILTER_REASON,
  type AliasResolutionError,
  type AliasResolutionErrorKind,
  type CandidateRef,
  type FilteredCandidate,
  type ModelCapabilities,
  type RoutingInput,
  type HardConstraints,
} from "./types";

// =============================================================================
// Alias Resolution
// =============================================================================

/**
 * Resolve an alias to its candidate list.
 *
 * @param alias - The model alias to resolve
 * @returns Candidate references or null if alias unknown
 */
export function resolveAlias(alias: string): CandidateRef[] | null {
  const mapping = getAliasMapping(alias);
  if (!mapping) {
    return null;
  }
  return mapping.candidates;
}

/**
 * Resolve alias with full error handling.
 *
 * @param alias - The model alias to resolve
 * @returns Candidate references
 * @throws AliasResolutionError if resolution fails
 */
export function resolveAliasOrThrow(alias: string): CandidateRef[] {
  const mapping = getAliasMapping(alias);

  if (!mapping) {
    throw createAliasResolutionError("unknown_alias", alias);
  }

  if (!mapping.enabled) {
    throw createAliasResolutionError("disabled_alias", alias);
  }

  // Filter to only enabled candidates
  const enabledCandidates = mapping.candidates.filter((c) => {
    const entry = getModelEntry(c.providerId, c.modelId);
    return entry?.enabled ?? false;
  });

  if (enabledCandidates.length === 0) {
    throw createAliasResolutionError("no_candidates", alias);
  }

  return enabledCandidates;
}

/**
 * Create an alias resolution error.
 */
function createAliasResolutionError(
  kind: AliasResolutionErrorKind,
  alias: string
): AliasResolutionError {
  return {
    kind,
    alias,
    message: `${ALIAS_RESOLUTION_ERRORS[kind]}: "${alias}"`,
  };
}

// =============================================================================
// Candidate Expansion
// =============================================================================

/**
 * Expand candidate references to full filtered candidates with capabilities.
 *
 * @param candidates - Candidate references from alias mapping
 * @returns Filtered candidates with full metadata
 */
export function expandCandidates(candidates: CandidateRef[]): FilteredCandidate[] {
  return candidates.map((ref) => {
    const entry = getModelEntry(ref.providerId, ref.modelId);

    if (!entry) {
      // Should not happen if config is validated, but handle gracefully
      return {
        providerId: ref.providerId,
        modelId: ref.modelId,
        capabilities: {
          providerId: ref.providerId,
          modelId: ref.modelId,
          contextWindow: 0,
          supportsStreaming: false,
          supportsTools: false,
        },
        costRates: {
          inputPer1kTokens: 0,
          outputPer1kTokens: 0,
          source: "config" as const,
          lastUpdated: 0,
        },
        filtered: true,
        filterReason: FILTER_REASON.model_not_found,
        priority: ref.priority,
      };
    }

    const capabilities: ModelCapabilities = {
      providerId: entry.providerId,
      modelId: entry.modelId,
      contextWindow: entry.contextWindow,
      supportsStreaming: entry.supportsStreaming,
      supportsTools: entry.supportsTools,
    };

    return {
      providerId: entry.providerId,
      modelId: entry.modelId,
      capabilities,
      costRates: entry.costRates,
      filtered: false,
      priority: ref.priority,
    };
  });
}

// =============================================================================
// Candidate Filtering
// =============================================================================

/**
 * Apply hard constraints to filter candidates.
 *
 * @param candidates - Candidates to filter
 * @param constraints - Hard constraints to apply
 * @returns Candidates with filter status updated
 */
export function applyHardConstraints(
  candidates: FilteredCandidate[],
  constraints: HardConstraints
): FilteredCandidate[] {
  return candidates.map((candidate) => {
    // Skip already filtered candidates
    if (candidate.filtered) {
      return candidate;
    }

    // Check streaming requirement
    if (constraints.streamingRequired && !candidate.capabilities.supportsStreaming) {
      return {
        ...candidate,
        filtered: true,
        filterReason: FILTER_REASON.no_streaming,
      };
    }

    // Check context length
    if (
      constraints.maxContextLength !== undefined &&
      candidate.capabilities.contextWindow < constraints.maxContextLength
    ) {
      return {
        ...candidate,
        filtered: true,
        filterReason: FILTER_REASON.context_too_small,
      };
    }

    // Check vendor allowlist
    if (
      constraints.vendorAllowlist &&
      constraints.vendorAllowlist.length > 0 &&
      !constraints.vendorAllowlist.includes(candidate.providerId)
    ) {
      return {
        ...candidate,
        filtered: true,
        filterReason: FILTER_REASON.vendor_not_allowed,
      };
    }

    // Check region allowlist (requires model entry with region)
    if (constraints.regionAllowlist && constraints.regionAllowlist.length > 0) {
      const entry = getModelEntry(candidate.providerId, candidate.modelId);
      if (entry?.region && !constraints.regionAllowlist.includes(entry.region)) {
        return {
          ...candidate,
          filtered: true,
          filterReason: FILTER_REASON.region_not_allowed,
        };
      }
    }

    return candidate;
  });
}

/**
 * Build hard constraints from routing input.
 */
export function buildHardConstraints(input: RoutingInput): HardConstraints {
  return {
    maxContextLength: input.estimatedInputTokens,
    streamingRequired: input.streamRequired,
    regionAllowlist: input.constraints?.regionAllowlist,
    vendorAllowlist: input.constraints?.vendorAllowlist,
  };
}

/**
 * Get only non-filtered candidates.
 */
export function getViableCandidates(
  candidates: FilteredCandidate[]
): FilteredCandidate[] {
  return candidates.filter((c) => !c.filtered);
}

/**
 * Check if any viable candidates remain.
 */
export function hasViableCandidates(candidates: FilteredCandidate[]): boolean {
  return candidates.some((c) => !c.filtered);
}
