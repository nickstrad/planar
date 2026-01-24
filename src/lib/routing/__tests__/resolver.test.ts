import {
  resolveAlias,
  resolveAliasOrThrow,
  expandCandidates,
  applyHardConstraints,
  buildHardConstraints,
  getViableCandidates,
  hasViableCandidates,
} from "../resolver";
import { initializeRoutingConfig, resetRoutingConfig } from "../config";
import {
  FILTER_REASON,
  isAliasResolutionError,
} from "../types";
import type {
  AliasResolutionError,
  HardConstraints,
  RoutingInput,
  ModelCatalogEntry,
  ModelAliasMapping,
} from "../types";

describe("Alias Resolution", () => {
  beforeEach(() => {
    resetRoutingConfig();
    initializeRoutingConfig();
  });

  describe("resolveAlias", () => {
    it("resolves valid alias to candidates", () => {
      const candidates = resolveAlias("gpt-4");
      expect(candidates).not.toBeNull();
      expect(candidates!.length).toBeGreaterThan(0);
      expect(candidates![0].providerId).toBe("openai");
    });

    it("returns null for unknown alias", () => {
      const candidates = resolveAlias("unknown-alias");
      expect(candidates).toBeNull();
    });
  });

  describe("resolveAliasOrThrow", () => {
    it("resolves valid alias", () => {
      const candidates = resolveAliasOrThrow("gpt-4");
      expect(candidates.length).toBeGreaterThan(0);
    });

    it("throws for unknown alias", () => {
      try {
        resolveAliasOrThrow("unknown-alias");
        fail("Should have thrown");
      } catch (e) {
        expect(isAliasResolutionError(e)).toBe(true);
        expect((e as AliasResolutionError).kind).toBe("unknown_alias");
      }
    });

    it("throws for disabled alias", () => {
      // Create config with disabled alias
      const catalog: ModelCatalogEntry[] = [
        {
          providerId: "test",
          modelId: "model",
          displayName: "Test",
          contextWindow: 4096,
          supportsStreaming: true,
          supportsTools: false,
          costRates: {
            inputPer1kTokens: 0.001,
            outputPer1kTokens: 0.002,
            source: "config",
            lastUpdated: Date.now(),
          },
          enabled: true,
        },
      ];

      const aliases: ModelAliasMapping[] = [
        {
          alias: "disabled-test",
          candidates: [{ providerId: "test", modelId: "model", priority: 0 }],
          defaultStrategy: "cheapest",
          enabled: false, // Disabled
        },
      ];

      resetRoutingConfig();
      initializeRoutingConfig(catalog, aliases);

      try {
        resolveAliasOrThrow("disabled-test");
        fail("Should have thrown");
      } catch (e) {
        expect(isAliasResolutionError(e)).toBe(true);
        expect((e as AliasResolutionError).kind).toBe("disabled_alias");
      }
    });
  });

  describe("expandCandidates", () => {
    it("expands candidate refs to full candidates", () => {
      const refs = resolveAliasOrThrow("gpt-4");
      const expanded = expandCandidates(refs);

      expect(expanded.length).toBe(refs.length);
      expect(expanded[0].capabilities).toBeDefined();
      expect(expanded[0].costRates).toBeDefined();
      expect(expanded[0].filtered).toBe(false);
    });
  });

  describe("applyHardConstraints", () => {
    it("filters candidates without streaming support", () => {
      // Create config with non-streaming model
      const catalog: ModelCatalogEntry[] = [
        {
          providerId: "test",
          modelId: "streaming",
          displayName: "Streaming Model",
          contextWindow: 4096,
          supportsStreaming: true,
          supportsTools: false,
          costRates: {
            inputPer1kTokens: 0.001,
            outputPer1kTokens: 0.002,
            source: "config",
            lastUpdated: Date.now(),
          },
          enabled: true,
        },
        {
          providerId: "test",
          modelId: "no-streaming",
          displayName: "No Streaming Model",
          contextWindow: 4096,
          supportsStreaming: false,
          supportsTools: false,
          costRates: {
            inputPer1kTokens: 0.001,
            outputPer1kTokens: 0.002,
            source: "config",
            lastUpdated: Date.now(),
          },
          enabled: true,
        },
      ];

      const aliases: ModelAliasMapping[] = [
        {
          alias: "test",
          candidates: [
            { providerId: "test", modelId: "streaming", priority: 0 },
            { providerId: "test", modelId: "no-streaming", priority: 1 },
          ],
          defaultStrategy: "cheapest",
          enabled: true,
        },
      ];

      resetRoutingConfig();
      initializeRoutingConfig(catalog, aliases);

      const refs = resolveAliasOrThrow("test");
      const expanded = expandCandidates(refs);

      const constraints: HardConstraints = {
        streamingRequired: true,
        maxContextLength: 1000,
      };

      const filtered = applyHardConstraints(expanded, constraints);

      expect(filtered[0].filtered).toBe(false); // streaming model passes
      expect(filtered[1].filtered).toBe(true); // no-streaming model filtered
      expect(filtered[1].filterReason).toBe(FILTER_REASON.no_streaming);
    });

    it("filters candidates with insufficient context window", () => {
      const refs = resolveAliasOrThrow("gpt-4");
      const expanded = expandCandidates(refs);

      const constraints: HardConstraints = {
        streamingRequired: false,
        maxContextLength: 1_000_000, // Larger than any model
      };

      const filtered = applyHardConstraints(expanded, constraints);

      expect(filtered.every((c) => c.filtered)).toBe(true);
      expect(filtered[0].filterReason).toBe(FILTER_REASON.context_too_small);
    });

    it("filters by vendor allowlist", () => {
      const refs = resolveAliasOrThrow("best"); // Cross-provider alias
      const expanded = expandCandidates(refs);

      const constraints: HardConstraints = {
        streamingRequired: false,
        vendorAllowlist: ["openai"],
      };

      const filtered = applyHardConstraints(expanded, constraints);
      const viable = getViableCandidates(filtered);

      expect(viable.every((c) => c.providerId === "openai")).toBe(true);
    });
  });

  describe("buildHardConstraints", () => {
    it("builds constraints from routing input", () => {
      const input: RoutingInput = {
        tenantId: "tenant-1",
        modelAlias: "gpt-4",
        streamRequired: true,
        estimatedInputTokens: 5000,
        constraints: {
          regionAllowlist: ["us-east"],
          vendorAllowlist: ["openai"],
        },
      };

      const constraints = buildHardConstraints(input);

      expect(constraints.streamingRequired).toBe(true);
      expect(constraints.maxContextLength).toBe(5000);
      expect(constraints.regionAllowlist).toEqual(["us-east"]);
      expect(constraints.vendorAllowlist).toEqual(["openai"]);
    });
  });

  describe("getViableCandidates / hasViableCandidates", () => {
    it("returns only non-filtered candidates", () => {
      const refs = resolveAliasOrThrow("gpt-4");
      const expanded = expandCandidates(refs);

      // Mark first as filtered
      expanded[0].filtered = true;
      expanded[0].filterReason = FILTER_REASON.model_not_found;

      const viable = getViableCandidates(expanded);

      expect(viable.length).toBe(expanded.length - 1);
      expect(hasViableCandidates(expanded)).toBe(true);
    });

    it("returns false when all filtered", () => {
      const refs = resolveAliasOrThrow("gpt-4");
      const expanded = expandCandidates(refs);

      // Mark all as filtered
      expanded.forEach((c) => {
        c.filtered = true;
        c.filterReason = FILTER_REASON.model_not_found;
      });

      expect(hasViableCandidates(expanded)).toBe(false);
      expect(getViableCandidates(expanded)).toHaveLength(0);
    });
  });
});
