import {
  estimateCost,
  calculateActualCost,
  sortByCost,
  filterByCostCap,
  findCheapest,
  isWithinBudget,
} from "../cost";
import { resolveAliasOrThrow, expandCandidates } from "../resolver";
import { initializeRoutingConfig, resetRoutingConfig } from "../config";
import { FILTER_REASON } from "../types";
import type { CostRates, ResolvedProvider } from "../types";

describe("Cost Estimation", () => {
  beforeEach(() => {
    resetRoutingConfig();
    initializeRoutingConfig();
  });

  const testRates: CostRates = {
    inputPer1kTokens: 0.01,
    outputPer1kTokens: 0.03,
    source: "config",
    lastUpdated: Date.now(),
  };

  const testProvider: ResolvedProvider = {
    providerId: "test",
    modelId: "test-model",
  };

  describe("estimateCost", () => {
    it("calculates cost with explicit output tokens", () => {
      const estimate = estimateCost(1000, 500, testRates, testProvider);

      expect(estimate.inputTokens).toBe(1000);
      expect(estimate.estimatedOutputTokens).toBe(500);
      expect(estimate.inputCostUsd).toBe(0.01); // 1000/1000 * 0.01
      expect(estimate.estimatedOutputCostUsd).toBe(0.015); // 500/1000 * 0.03
      expect(estimate.totalEstimateUsd).toBe(0.025);
      expect(estimate.provider).toEqual(testProvider);
    });

    it("estimates output tokens when not specified", () => {
      const estimate = estimateCost(1000, undefined, testRates, testProvider);

      // Default: 50% of input
      expect(estimate.estimatedOutputTokens).toBe(500);
    });

    it("handles zero cost rates (free models)", () => {
      const freeRates: CostRates = {
        inputPer1kTokens: 0,
        outputPer1kTokens: 0,
        source: "config",
        lastUpdated: Date.now(),
      };

      const estimate = estimateCost(10000, 5000, freeRates, testProvider);

      expect(estimate.inputCostUsd).toBe(0);
      expect(estimate.estimatedOutputCostUsd).toBe(0);
      expect(estimate.totalEstimateUsd).toBe(0);
    });
  });

  describe("calculateActualCost", () => {
    it("calculates actual cost from token counts", () => {
      const actual = calculateActualCost(1000, 750, testRates, testProvider);

      expect(actual.inputTokens).toBe(1000);
      expect(actual.outputTokens).toBe(750);
      expect(actual.inputCostUsd).toBe(0.01);
      expect(actual.outputCostUsd).toBe(0.0225); // 750/1000 * 0.03
      expect(actual.totalCostUsd).toBe(0.0325);
    });
  });

  describe("sortByCost", () => {
    it("sorts candidates by total cost rate", () => {
      const refs = resolveAliasOrThrow("cheap");
      const expanded = expandCandidates(refs);

      const sorted = sortByCost(expanded);

      // Verify sorted ascending by cost
      for (let i = 1; i < sorted.length; i++) {
        const prevCost =
          sorted[i - 1].costRates.inputPer1kTokens +
          sorted[i - 1].costRates.outputPer1kTokens;
        const currCost =
          sorted[i].costRates.inputPer1kTokens +
          sorted[i].costRates.outputPer1kTokens;
        expect(currCost).toBeGreaterThanOrEqual(prevCost);
      }
    });

    it("preserves priority order when costs are equal", () => {
      const refs = resolveAliasOrThrow("local"); // All free (Ollama)
      const expanded = expandCandidates(refs);

      const sorted = sortByCost(expanded);

      // When costs are equal, should maintain priority order
      for (let i = 1; i < sorted.length; i++) {
        const prevCost =
          sorted[i - 1].costRates.inputPer1kTokens +
          sorted[i - 1].costRates.outputPer1kTokens;
        const currCost =
          sorted[i].costRates.inputPer1kTokens +
          sorted[i].costRates.outputPer1kTokens;

        if (prevCost === currCost) {
          expect(sorted[i].priority).toBeGreaterThanOrEqual(
            sorted[i - 1].priority
          );
        }
      }
    });

    it("does not mutate original array", () => {
      const refs = resolveAliasOrThrow("cheap");
      const expanded = expandCandidates(refs);
      const originalOrder = expanded.map((c) => c.modelId);

      sortByCost(expanded);

      const afterOrder = expanded.map((c) => c.modelId);
      expect(afterOrder).toEqual(originalOrder);
    });
  });

  describe("filterByCostCap", () => {
    it("filters candidates exceeding cost cap", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);

      // Set a low cost cap
      const filtered = filterByCostCap(expanded, 0.001, 1000, 500);

      // Some should be filtered
      const filteredCount = filtered.filter((c) => c.filtered).length;
      expect(filteredCount).toBeGreaterThan(0);
    });

    it("preserves already filtered candidates", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);

      // Pre-filter one
      expanded[0].filtered = true;
      expanded[0].filterReason = FILTER_REASON.model_not_found;

      const filtered = filterByCostCap(expanded, 1000, 1000, 500);

      // Original filter reason preserved
      expect(filtered[0].filterReason).toBe(FILTER_REASON.model_not_found);
    });

    it("uses cost_exceeded filter reason", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);

      const filtered = filterByCostCap(expanded, 0.0001, 1000, 500);

      const costFiltered = filtered.find(
        (c) => c.filterReason === FILTER_REASON.cost_exceeded
      );
      expect(costFiltered).toBeDefined();
    });
  });

  describe("findCheapest", () => {
    it("returns cheapest non-filtered candidate", () => {
      const refs = resolveAliasOrThrow("cheap");
      const expanded = expandCandidates(refs);

      const cheapest = findCheapest(expanded);

      expect(cheapest).not.toBeNull();
      // Ollama should be cheapest
      expect(cheapest?.providerId).toBe("ollama");
    });

    it("returns null when all filtered", () => {
      const refs = resolveAliasOrThrow("cheap");
      const expanded = expandCandidates(refs);

      expanded.forEach((c) => {
        c.filtered = true;
      });

      const cheapest = findCheapest(expanded);
      expect(cheapest).toBeNull();
    });
  });

  describe("isWithinBudget", () => {
    it("returns true when within budget", () => {
      const estimate = estimateCost(1000, 500, testRates, testProvider);
      expect(isWithinBudget(estimate, 1.0)).toBe(true);
    });

    it("returns false when over budget", () => {
      const estimate = estimateCost(1000, 500, testRates, testProvider);
      expect(isWithinBudget(estimate, 0.001)).toBe(false);
    });

    it("returns true at exact budget", () => {
      const estimate = estimateCost(1000, 500, testRates, testProvider);
      expect(isWithinBudget(estimate, estimate.totalEstimateUsd)).toBe(true);
    });
  });
});
