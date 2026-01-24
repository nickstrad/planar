import {
  selectCheapest,
  selectQuality,
  selectPinned,
  selectPrimary,
  buildFallbackChain,
  determineStrategy,
  applyTenantPolicy,
  route,
} from "../selector";
import {
  resolveAliasOrThrow,
  expandCandidates,
  getViableCandidates,
} from "../resolver";
import { initializeRoutingConfig, resetRoutingConfig } from "../config";
import { clearAllPolicies } from "../policy";
import type {
  FilteredCandidate,
  RoutingInput,
  TenantRoutingPolicy,
} from "../types";
import { isPolicyConstraintError, isAliasResolutionError } from "../types";

describe("Candidate Selection", () => {
  beforeEach(() => {
    resetRoutingConfig();
    clearAllPolicies();
    initializeRoutingConfig();
  });

  describe("selectCheapest", () => {
    it("selects cheapest viable candidate", () => {
      const refs = resolveAliasOrThrow("cheap");
      const expanded = expandCandidates(refs);

      const selected = selectCheapest(expanded);

      expect(selected).not.toBeNull();
      // Ollama should be cheapest (free)
      expect(selected?.providerId).toBe("ollama");
    });

    it("returns null when no viable candidates", () => {
      const refs = resolveAliasOrThrow("gpt-4");
      const expanded = expandCandidates(refs);

      // Mark all as filtered
      expanded.forEach((c) => {
        c.filtered = true;
      });

      const selected = selectCheapest(expanded);
      expect(selected).toBeNull();
    });
  });

  describe("selectQuality", () => {
    it("selects candidate with largest context window", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);

      const selected = selectQuality(expanded);

      expect(selected).not.toBeNull();
      // Anthropic models have 200k context
      expect(selected?.providerId).toBe("anthropic");
    });
  });

  describe("selectPinned", () => {
    it("selects specific provider/model", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);

      const selected = selectPinned(expanded, "openai", "gpt-4o");

      expect(selected).not.toBeNull();
      expect(selected?.providerId).toBe("openai");
      expect(selected?.modelId).toBe("gpt-4o");
    });

    it("returns null if pinned model not in candidates", () => {
      const refs = resolveAliasOrThrow("gpt-4"); // OpenAI only
      const expanded = expandCandidates(refs);

      const selected = selectPinned(
        expanded,
        "anthropic",
        "claude-3-5-sonnet-20241022"
      );

      expect(selected).toBeNull();
    });

    it("returns null if pinned model is filtered", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);

      // Filter out the target
      const target = expanded.find(
        (c) => c.providerId === "openai" && c.modelId === "gpt-4o"
      );
      if (target) {
        target.filtered = true;
      }

      const selected = selectPinned(expanded, "openai", "gpt-4o");
      expect(selected).toBeNull();
    });
  });

  describe("selectPrimary", () => {
    it("delegates to correct strategy", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);

      const cheapest = selectPrimary(expanded, "cheapest");
      const quality = selectPrimary(expanded, "quality");

      expect(cheapest).not.toBeNull();
      expect(quality).not.toBeNull();
      // They may or may not be the same depending on config
    });

    it("handles pinned strategy with provider", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);

      const pinned = selectPrimary(expanded, "pinned", {
        providerId: "openai",
        modelId: "gpt-4o",
      });

      expect(pinned?.providerId).toBe("openai");
      expect(pinned?.modelId).toBe("gpt-4o");
    });

    it("falls back to cheapest when pinned has no provider", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);

      const pinned = selectPrimary(expanded, "pinned");
      const cheapest = selectCheapest(expanded);

      expect(pinned?.providerId).toBe(cheapest?.providerId);
    });
  });

  describe("buildFallbackChain", () => {
    it("builds fallback chain excluding primary", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);
      const primary = selectCheapest(expanded)!;

      const fallbacks = buildFallbackChain(expanded, primary, 3);

      expect(fallbacks.length).toBeLessThanOrEqual(3);
      expect(
        fallbacks.some(
          (f) =>
            f.providerId === primary.providerId &&
            f.modelId === primary.modelId
        )
      ).toBe(false);
    });

    it("respects maxCandidates limit", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);
      const primary = selectCheapest(expanded)!;

      const fallbacks = buildFallbackChain(expanded, primary, 1);

      expect(fallbacks.length).toBeLessThanOrEqual(1);
    });
  });

  describe("applyTenantPolicy", () => {
    it("filters denied providers", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);

      const policy: TenantRoutingPolicy = {
        tenantId: "test",
        deniedProviders: ["anthropic"],
      };

      const filtered = applyTenantPolicy(expanded, policy);
      const viable = getViableCandidates(filtered);

      expect(viable.some((c) => c.providerId === "anthropic")).toBe(false);
    });

    it("filters to allowed providers only", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);

      const policy: TenantRoutingPolicy = {
        tenantId: "test",
        allowedProviders: ["openai"],
      };

      const filtered = applyTenantPolicy(expanded, policy);
      const viable = getViableCandidates(filtered);

      expect(viable.every((c) => c.providerId === "openai")).toBe(true);
    });

    it("denied overrides allowed", () => {
      const refs = resolveAliasOrThrow("best");
      const expanded = expandCandidates(refs);

      const policy: TenantRoutingPolicy = {
        tenantId: "test",
        allowedProviders: ["openai", "anthropic"],
        deniedProviders: ["anthropic"],
      };

      const filtered = applyTenantPolicy(expanded, policy);
      const viable = getViableCandidates(filtered);

      expect(viable.some((c) => c.providerId === "anthropic")).toBe(false);
    });
  });

  describe("determineStrategy", () => {
    it("prefers explicit request strategy", () => {
      const input: RoutingInput = {
        tenantId: "test",
        modelAlias: "best",
        streamRequired: false,
        estimatedInputTokens: 1000,
        strategy: "quality",
      };

      const policy: TenantRoutingPolicy = {
        tenantId: "test",
        defaultStrategy: "cheapest",
      };

      const strategy = determineStrategy(input, policy);
      expect(strategy).toBe("quality");
    });

    it("uses tenant policy when no explicit strategy", () => {
      const input: RoutingInput = {
        tenantId: "test",
        modelAlias: "best",
        streamRequired: false,
        estimatedInputTokens: 1000,
      };

      const policy: TenantRoutingPolicy = {
        tenantId: "test",
        defaultStrategy: "quality",
      };

      const strategy = determineStrategy(input, policy);
      expect(strategy).toBe("quality");
    });

    it("falls back to alias default", () => {
      const input: RoutingInput = {
        tenantId: "test",
        modelAlias: "best", // defaultStrategy: "quality"
        streamRequired: false,
        estimatedInputTokens: 1000,
      };

      const strategy = determineStrategy(input, null);
      expect(strategy).toBe("quality");
    });
  });

  describe("route", () => {
    it("produces valid routing snapshot", () => {
      const input: RoutingInput = {
        tenantId: "test-tenant",
        modelAlias: "gpt-4",
        streamRequired: true,
        estimatedInputTokens: 1000,
      };

      const snapshot = route(input);

      expect(snapshot.snapshotId).toMatch(/^snap_/);
      expect(snapshot.primary.providerId).toBe("openai");
      expect(snapshot.strategy).toBeDefined();
      expect(snapshot.resolvedAlias).toBe("gpt-4");
      expect(snapshot.tenantId).toBe("test-tenant");
      expect(snapshot.costEstimate).toBeDefined();
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });

    it("throws for unknown alias", () => {
      const input: RoutingInput = {
        tenantId: "test",
        modelAlias: "unknown-alias",
        streamRequired: false,
        estimatedInputTokens: 1000,
      };

      try {
        route(input);
        fail("Should have thrown");
      } catch (e) {
        expect(isAliasResolutionError(e)).toBe(true);
      }
    });

    it("throws when all candidates filtered", () => {
      const input: RoutingInput = {
        tenantId: "test",
        modelAlias: "gpt-4",
        streamRequired: false,
        estimatedInputTokens: 1000,
        constraints: {
          vendorAllowlist: ["nonexistent-vendor"],
        },
      };

      try {
        route(input);
        fail("Should have thrown");
      } catch (e) {
        expect(isPolicyConstraintError(e)).toBe(true);
      }
    });

    it("applies tenant policy", () => {
      const input: RoutingInput = {
        tenantId: "test",
        modelAlias: "best",
        streamRequired: false,
        estimatedInputTokens: 1000,
      };

      const policy: TenantRoutingPolicy = {
        tenantId: "test",
        allowedProviders: ["openai"],
      };

      const snapshot = route(input, policy);

      expect(snapshot.primary.providerId).toBe("openai");
    });

    it("enforces cost cap", () => {
      const input: RoutingInput = {
        tenantId: "test",
        modelAlias: "best",
        streamRequired: false,
        estimatedInputTokens: 1000,
        maxOutputTokens: 1000,
        constraints: {
          maxCostUsd: 0.0001, // Very low cap
        },
      };

      // Should filter expensive models, might fail if all exceed cap
      try {
        const snapshot = route(input);
        // If it succeeds, verify cost is within cap
        expect(snapshot.costEstimate.totalEstimateUsd).toBeLessThanOrEqual(
          0.0001
        );
      } catch (e) {
        // Expected if all candidates exceed cap
        expect(isPolicyConstraintError(e)).toBe(true);
      }
    });

    it("includes fallbacks in snapshot", () => {
      const input: RoutingInput = {
        tenantId: "test",
        modelAlias: "best", // Has multiple candidates
        streamRequired: false,
        estimatedInputTokens: 1000,
      };

      const snapshot = route(input);

      expect(snapshot.fallbacks).toBeDefined();
      expect(Array.isArray(snapshot.fallbacks)).toBe(true);
    });
  });
});
