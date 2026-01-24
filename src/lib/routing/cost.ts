/**
 * Cost Estimation
 *
 * Pre-inference cost estimation and post-inference cost calculation.
 */

import { ResolvedProvider } from "../common";
import { FILTER_REASON } from "./types";
import type {
  CostEstimate,
  ActualCost,
  CostRates,
  FilteredCandidate,
} from "./types";

// =============================================================================
// Cost Estimation
// =============================================================================

/**
 * Estimate cost before inference.
 *
 * @param inputTokens - Number of input tokens
 * @param maxOutputTokens - Max output tokens (if specified)
 * @param costRates - Cost rates for the model
 * @param provider - Provider being used
 * @returns Cost estimate
 */
export function estimateCost(
  inputTokens: number,
  maxOutputTokens: number | undefined,
  costRates: CostRates,
  provider: ResolvedProvider,
): CostEstimate {
  // Estimate output tokens: use maxOutputTokens if specified, otherwise assume 50% of input
  const estimatedOutputTokens = maxOutputTokens ?? Math.ceil(inputTokens * 0.5);

  const inputCostUsd = (inputTokens / 1000) * costRates.inputPer1kTokens;
  const estimatedOutputCostUsd =
    (estimatedOutputTokens / 1000) * costRates.outputPer1kTokens;

  return {
    inputTokens,
    estimatedOutputTokens,
    inputCostUsd,
    estimatedOutputCostUsd,
    totalEstimateUsd: inputCostUsd + estimatedOutputCostUsd,
    provider,
  };
}

/**
 * Calculate actual cost after inference.
 *
 * @param inputTokens - Actual input tokens
 * @param outputTokens - Actual output tokens
 * @param costRates - Cost rates for the model
 * @param provider - Provider used
 * @returns Actual cost
 */
export function calculateActualCost(
  inputTokens: number,
  outputTokens: number,
  costRates: CostRates,
  provider: ResolvedProvider,
): ActualCost {
  const inputCostUsd = (inputTokens / 1000) * costRates.inputPer1kTokens;
  const outputCostUsd = (outputTokens / 1000) * costRates.outputPer1kTokens;

  return {
    inputTokens,
    outputTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
    provider,
  };
}

// =============================================================================
// Cost-Based Sorting
// =============================================================================

/**
 * Sort candidates by total cost (cheapest first).
 *
 * @param candidates - Candidates to sort
 * @returns Sorted candidates (does not mutate input)
 */
export function sortByCost(
  candidates: FilteredCandidate[],
): FilteredCandidate[] {
  return [...candidates].sort((a, b) => {
    const aCost = getTotalRate(a.costRates);
    const bCost = getTotalRate(b.costRates);
    // If costs are equal, preserve priority order
    if (aCost === bCost) {
      return a.priority - b.priority;
    }
    return aCost - bCost;
  });
}

/**
 * Get total cost rate (input + output per 1k tokens).
 */
function getTotalRate(rates: CostRates): number {
  return rates.inputPer1kTokens + rates.outputPer1kTokens;
}

// =============================================================================
// Cost Cap Enforcement
// =============================================================================

/**
 * Filter candidates that exceed a cost cap.
 *
 * @param candidates - Candidates to filter
 * @param maxCostUsd - Maximum allowed cost per request
 * @param inputTokens - Expected input tokens
 * @param maxOutputTokens - Expected max output tokens
 * @returns Candidates with cost-exceeding ones filtered
 */
export function filterByCostCap(
  candidates: FilteredCandidate[],
  maxCostUsd: number,
  inputTokens: number,
  maxOutputTokens: number | undefined,
): FilteredCandidate[] {
  const estimatedOutput = maxOutputTokens ?? Math.ceil(inputTokens * 0.5);

  return candidates.map((candidate) => {
    if (candidate.filtered) {
      return candidate;
    }

    const estimate = estimateCost(
      inputTokens,
      estimatedOutput,
      candidate.costRates,
      { providerId: candidate.providerId, modelId: candidate.modelId },
    );

    if (estimate.totalEstimateUsd > maxCostUsd) {
      return {
        ...candidate,
        filtered: true,
        filterReason: FILTER_REASON.cost_exceeded,
      };
    }

    return candidate;
  });
}

// =============================================================================
// Cost Comparison Utilities
// =============================================================================

/**
 * Find the cheapest candidate from a list.
 *
 * @param candidates - Candidates to compare (should be non-filtered)
 * @returns Cheapest candidate or null if empty
 */
export function findCheapest(
  candidates: FilteredCandidate[],
): FilteredCandidate | null {
  const viable = candidates.filter((c) => !c.filtered);
  if (viable.length === 0) {
    return null;
  }

  return sortByCost(viable)[0];
}

/**
 * Check if a cost estimate is within a budget.
 */
export function isWithinBudget(
  estimate: CostEstimate,
  maxCostUsd: number,
): boolean {
  return estimate.totalEstimateUsd <= maxCostUsd;
}
