import {
  loadTenantPolicy,
  loadTenantPolicySync,
  setTenantPolicy,
  clearTenantPolicy,
  clearAllPolicies,
  validatePolicy,
  mergeWithPlatformDefaults,
  extractHardConstraints,
  extractSoftConstraints,
  resolveStrategy,
  isProviderAllowed,
  getEffectiveCostCap,
  PolicyValidationError,
} from "../policy";
import { initializeRoutingConfig, resetRoutingConfig } from "../config";
import type { TenantRoutingPolicy, RoutingInput } from "../types";

describe("Tenant Routing Policy", () => {
  beforeEach(() => {
    resetRoutingConfig();
    clearAllPolicies();
    initializeRoutingConfig();
  });

  describe("validatePolicy", () => {
    it("validates correct policy", () => {
      const policy = validatePolicy(
        {
          allowedProviders: ["openai", "anthropic"],
          defaultStrategy: "cheapest",
        },
        "tenant-1"
      );

      expect(policy.tenantId).toBe("tenant-1");
      expect(policy.allowedProviders).toEqual(["openai", "anthropic"]);
    });

    it("rejects invalid strategy", () => {
      expect(() =>
        validatePolicy(
          {
            defaultStrategy: "invalid-strategy",
          },
          "tenant-1"
        )
      ).toThrow(PolicyValidationError);
    });

    it("rejects overlap between allowed and denied", () => {
      expect(() =>
        validatePolicy(
          {
            allowedProviders: ["openai", "anthropic"],
            deniedProviders: ["anthropic"],
          },
          "tenant-1"
        )
      ).toThrow(PolicyValidationError);
    });

    it("rejects preferred provider in denied list", () => {
      expect(() =>
        validatePolicy(
          {
            deniedProviders: ["openai"],
            preferredProvider: "openai",
          },
          "tenant-1"
        )
      ).toThrow(PolicyValidationError);
    });

    it("allows empty policy", () => {
      const policy = validatePolicy({}, "tenant-1");
      expect(policy.tenantId).toBe("tenant-1");
    });
  });

  describe("setTenantPolicy / loadTenantPolicy", () => {
    it("stores and retrieves policy", async () => {
      const policy: TenantRoutingPolicy = {
        tenantId: "tenant-1",
        allowedProviders: ["openai"],
        defaultStrategy: "quality",
      };

      setTenantPolicy(policy);

      const loaded = await loadTenantPolicy("tenant-1");
      expect(loaded).toEqual(policy);
    });

    it("returns null for unknown tenant", async () => {
      const loaded = await loadTenantPolicy("unknown-tenant");
      expect(loaded).toBeNull();
    });

    it("sync load returns cached policy", () => {
      const policy: TenantRoutingPolicy = {
        tenantId: "tenant-1",
        allowedProviders: ["openai"],
      };

      setTenantPolicy(policy);

      const loaded = loadTenantPolicySync("tenant-1");
      expect(loaded).toEqual(policy);
    });
  });

  describe("clearTenantPolicy / clearAllPolicies", () => {
    it("clears specific tenant policy", async () => {
      setTenantPolicy({ tenantId: "tenant-1", allowedProviders: ["openai"] });
      setTenantPolicy({ tenantId: "tenant-2", allowedProviders: ["anthropic"] });

      clearTenantPolicy("tenant-1");

      expect(await loadTenantPolicy("tenant-1")).toBeNull();
      expect(await loadTenantPolicy("tenant-2")).not.toBeNull();
    });

    it("clears all policies", async () => {
      setTenantPolicy({ tenantId: "tenant-1", allowedProviders: ["openai"] });
      setTenantPolicy({ tenantId: "tenant-2", allowedProviders: ["anthropic"] });

      clearAllPolicies();

      expect(await loadTenantPolicy("tenant-1")).toBeNull();
      expect(await loadTenantPolicy("tenant-2")).toBeNull();
    });
  });

  describe("mergeWithPlatformDefaults", () => {
    it("returns platform defaults when no tenant policy", () => {
      const merged = mergeWithPlatformDefaults(null);

      expect(merged.tenantId).toBe("platform");
      expect(merged.defaultStrategy).toBe("cheapest");
    });

    it("preserves tenant overrides", () => {
      const policy: TenantRoutingPolicy = {
        tenantId: "tenant-1",
        defaultStrategy: "quality",
        maxCostPerRequestUsd: 0.5,
      };

      const merged = mergeWithPlatformDefaults(policy);

      expect(merged.tenantId).toBe("tenant-1");
      expect(merged.defaultStrategy).toBe("quality");
      expect(merged.maxCostPerRequestUsd).toBe(0.5);
    });
  });

  describe("extractHardConstraints", () => {
    it("extracts vendor allowlist", () => {
      const policy: TenantRoutingPolicy = {
        tenantId: "tenant-1",
        allowedProviders: ["openai", "anthropic"],
      };

      const constraints = extractHardConstraints(policy);

      expect(constraints.vendorAllowlist).toEqual(["openai", "anthropic"]);
    });

    it("returns empty object for null policy", () => {
      const constraints = extractHardConstraints(null);
      expect(constraints).toEqual({});
    });
  });

  describe("extractSoftConstraints", () => {
    it("extracts all soft constraints", () => {
      const policy: TenantRoutingPolicy = {
        tenantId: "tenant-1",
        defaultStrategy: "quality",
        maxCostPerRequestUsd: 0.5,
        preferredProvider: "anthropic",
      };

      const constraints = extractSoftConstraints(policy);

      expect(constraints.preferredStrategy).toBe("quality");
      expect(constraints.maxCostUsd).toBe(0.5);
      expect(constraints.preferredProvider).toBe("anthropic");
    });
  });

  describe("resolveStrategy", () => {
    it("prefers explicit request strategy", () => {
      const input: RoutingInput = {
        tenantId: "tenant-1",
        modelAlias: "gpt-4",
        streamRequired: false,
        estimatedInputTokens: 1000,
        strategy: "pinned",
      };

      const policy: TenantRoutingPolicy = {
        tenantId: "tenant-1",
        defaultStrategy: "quality",
      };

      expect(resolveStrategy(input, policy)).toBe("pinned");
    });

    it("uses tenant policy when no explicit strategy", () => {
      const input: RoutingInput = {
        tenantId: "tenant-1",
        modelAlias: "gpt-4",
        streamRequired: false,
        estimatedInputTokens: 1000,
      };

      const policy: TenantRoutingPolicy = {
        tenantId: "tenant-1",
        defaultStrategy: "quality",
      };

      expect(resolveStrategy(input, policy)).toBe("quality");
    });

    it("defaults to cheapest", () => {
      const input: RoutingInput = {
        tenantId: "tenant-1",
        modelAlias: "gpt-4",
        streamRequired: false,
        estimatedInputTokens: 1000,
      };

      expect(resolveStrategy(input, null)).toBe("cheapest");
    });
  });

  describe("isProviderAllowed", () => {
    it("allows all when no policy", () => {
      expect(isProviderAllowed("openai", null)).toBe(true);
      expect(isProviderAllowed("anthropic", null)).toBe(true);
    });

    it("denies providers in denied list", () => {
      const policy: TenantRoutingPolicy = {
        tenantId: "tenant-1",
        deniedProviders: ["openai"],
      };

      expect(isProviderAllowed("openai", policy)).toBe(false);
      expect(isProviderAllowed("anthropic", policy)).toBe(true);
    });

    it("only allows providers in allowed list", () => {
      const policy: TenantRoutingPolicy = {
        tenantId: "tenant-1",
        allowedProviders: ["openai"],
      };

      expect(isProviderAllowed("openai", policy)).toBe(true);
      expect(isProviderAllowed("anthropic", policy)).toBe(false);
    });

    it("denied overrides allowed", () => {
      const policy: TenantRoutingPolicy = {
        tenantId: "tenant-1",
        allowedProviders: ["openai", "anthropic"],
        deniedProviders: ["anthropic"],
      };

      expect(isProviderAllowed("openai", policy)).toBe(true);
      expect(isProviderAllowed("anthropic", policy)).toBe(false);
    });
  });

  describe("getEffectiveCostCap", () => {
    it("prefers request cost cap", () => {
      const input: RoutingInput = {
        tenantId: "tenant-1",
        modelAlias: "gpt-4",
        streamRequired: false,
        estimatedInputTokens: 1000,
        constraints: {
          maxCostUsd: 0.1,
        },
      };

      const policy: TenantRoutingPolicy = {
        tenantId: "tenant-1",
        maxCostPerRequestUsd: 0.5,
      };

      expect(getEffectiveCostCap(input, policy)).toBe(0.1);
    });

    it("uses tenant policy when no request cap", () => {
      const input: RoutingInput = {
        tenantId: "tenant-1",
        modelAlias: "gpt-4",
        streamRequired: false,
        estimatedInputTokens: 1000,
      };

      const policy: TenantRoutingPolicy = {
        tenantId: "tenant-1",
        maxCostPerRequestUsd: 0.5,
      };

      expect(getEffectiveCostCap(input, policy)).toBe(0.5);
    });

    it("returns undefined when no cap", () => {
      const input: RoutingInput = {
        tenantId: "tenant-1",
        modelAlias: "gpt-4",
        streamRequired: false,
        estimatedInputTokens: 1000,
      };

      expect(getEffectiveCostCap(input, null)).toBeUndefined();
    });
  });
});
