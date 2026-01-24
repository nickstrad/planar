import {
  initializeRoutingConfig,
  getModelCatalog,
  getModelEntry,
  getAliasMapping,
  getAllAliasMappings,
  isConfigInitialized,
  resetRoutingConfig,
  ConfigValidationError,
} from "../config";
import type { ModelCatalogEntry, ModelAliasMapping } from "../types";

describe("Routing Config", () => {
  beforeEach(() => {
    resetRoutingConfig();
  });

  describe("initializeRoutingConfig", () => {
    it("initializes with default config", () => {
      expect(isConfigInitialized()).toBe(false);
      initializeRoutingConfig();
      expect(isConfigInitialized()).toBe(true);
    });

    it("validates catalog entries", () => {
      const invalidCatalog = [
        {
          providerId: "", // Invalid: empty string
          modelId: "gpt-4o",
          displayName: "GPT-4o",
          contextWindow: 128000,
          supportsStreaming: true,
          supportsTools: true,
          costRates: {
            inputPer1kTokens: 0.0025,
            outputPer1kTokens: 0.01,
            source: "config" as const,
            lastUpdated: Date.now(),
          },
          enabled: true,
        },
      ];

      expect(() => initializeRoutingConfig(invalidCatalog, [])).toThrow(
        ConfigValidationError
      );
    });

    it("validates alias mappings reference existing models", () => {
      const catalog: ModelCatalogEntry[] = [
        {
          providerId: "openai",
          modelId: "gpt-4o",
          displayName: "GPT-4o",
          contextWindow: 128000,
          supportsStreaming: true,
          supportsTools: true,
          costRates: {
            inputPer1kTokens: 0.0025,
            outputPer1kTokens: 0.01,
            source: "config",
            lastUpdated: Date.now(),
          },
          enabled: true,
        },
      ];

      const invalidAliases: ModelAliasMapping[] = [
        {
          alias: "test",
          candidates: [
            { providerId: "unknown", modelId: "unknown-model", priority: 0 },
          ],
          defaultStrategy: "cheapest",
          enabled: true,
        },
      ];

      expect(() => initializeRoutingConfig(catalog, invalidAliases)).toThrow(
        ConfigValidationError
      );
    });

    it("allows valid custom config", () => {
      const catalog: ModelCatalogEntry[] = [
        {
          providerId: "test-provider",
          modelId: "test-model",
          displayName: "Test Model",
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
          alias: "test",
          candidates: [
            { providerId: "test-provider", modelId: "test-model", priority: 0 },
          ],
          defaultStrategy: "cheapest",
          enabled: true,
        },
      ];

      expect(() => initializeRoutingConfig(catalog, aliases)).not.toThrow();
      expect(getModelCatalog()).toHaveLength(1);
      expect(getAllAliasMappings()).toHaveLength(1);
    });
  });

  describe("getModelCatalog", () => {
    it("returns default catalog when auto-initialized", () => {
      const catalog = getModelCatalog();
      expect(catalog.length).toBeGreaterThan(0);
      expect(catalog.some((e) => e.providerId === "openai")).toBe(true);
      expect(catalog.some((e) => e.providerId === "anthropic")).toBe(true);
    });
  });

  describe("getModelEntry", () => {
    it("returns entry for valid provider/model", () => {
      initializeRoutingConfig();
      const entry = getModelEntry("openai", "gpt-4o");
      expect(entry).not.toBeNull();
      expect(entry?.providerId).toBe("openai");
      expect(entry?.modelId).toBe("gpt-4o");
    });

    it("returns null for unknown provider/model", () => {
      initializeRoutingConfig();
      const entry = getModelEntry("unknown", "unknown");
      expect(entry).toBeNull();
    });
  });

  describe("getAliasMapping", () => {
    it("returns mapping for valid alias", () => {
      initializeRoutingConfig();
      const mapping = getAliasMapping("gpt-4");
      expect(mapping).not.toBeNull();
      expect(mapping?.alias).toBe("gpt-4");
      expect(mapping?.candidates.length).toBeGreaterThan(0);
    });

    it("returns null for unknown alias", () => {
      initializeRoutingConfig();
      const mapping = getAliasMapping("unknown-alias");
      expect(mapping).toBeNull();
    });
  });
});
