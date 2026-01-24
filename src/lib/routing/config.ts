/**
 * Routing Configuration
 *
 * Model catalog and alias mappings for the routing system.
 * This module is server-only and provides static configuration
 * that can be validated at startup.
 */

import { z } from "zod";
import { ROUTING_STRATEGY, RoutingStrategySchema } from "./types";
import type {
  ModelCatalogEntry,
  ModelAliasMapping,
  CostRates,
} from "./types";

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

const CostRatesSchema = z.object({
  inputPer1kTokens: z.number().nonnegative(),
  outputPer1kTokens: z.number().nonnegative(),
  source: z.enum(["config", "api"]),
  lastUpdated: z.number(),
});

const ModelCatalogEntrySchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  contextWindow: z.number().int().positive(),
  supportsStreaming: z.boolean(),
  supportsTools: z.boolean(),
  costRates: CostRatesSchema,
  enabled: z.boolean(),
  region: z.string().optional(),
});

const CandidateRefSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  priority: z.number().int().nonnegative(),
});

const ModelAliasMappingSchema = z.object({
  alias: z.string().min(1),
  candidates: z.array(CandidateRefSchema).min(1),
  defaultStrategy: RoutingStrategySchema,
  enabled: z.boolean(),
});

export const ModelCatalogSchema = z.array(ModelCatalogEntrySchema);
export const AliasMappingsSchema = z.array(ModelAliasMappingSchema);

// =============================================================================
// Default Model Catalog
// =============================================================================

const DEFAULT_CATALOG: ModelCatalogEntry[] = [
  // OpenAI Models
  {
    providerId: "openai",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    contextWindow: 128_000,
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
  {
    providerId: "openai",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    contextWindow: 128_000,
    supportsStreaming: true,
    supportsTools: true,
    costRates: {
      inputPer1kTokens: 0.00015,
      outputPer1kTokens: 0.0006,
      source: "config",
      lastUpdated: Date.now(),
    },
    enabled: true,
  },
  {
    providerId: "openai",
    modelId: "gpt-4-turbo",
    displayName: "GPT-4 Turbo",
    contextWindow: 128_000,
    supportsStreaming: true,
    supportsTools: true,
    costRates: {
      inputPer1kTokens: 0.01,
      outputPer1kTokens: 0.03,
      source: "config",
      lastUpdated: Date.now(),
    },
    enabled: true,
  },

  // Anthropic Models
  {
    providerId: "anthropic",
    modelId: "claude-3-5-sonnet-20241022",
    displayName: "Claude 3.5 Sonnet",
    contextWindow: 200_000,
    supportsStreaming: true,
    supportsTools: true,
    costRates: {
      inputPer1kTokens: 0.003,
      outputPer1kTokens: 0.015,
      source: "config",
      lastUpdated: Date.now(),
    },
    enabled: true,
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-5-haiku-20241022",
    displayName: "Claude 3.5 Haiku",
    contextWindow: 200_000,
    supportsStreaming: true,
    supportsTools: true,
    costRates: {
      inputPer1kTokens: 0.0008,
      outputPer1kTokens: 0.004,
      source: "config",
      lastUpdated: Date.now(),
    },
    enabled: true,
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-opus-20240229",
    displayName: "Claude 3 Opus",
    contextWindow: 200_000,
    supportsStreaming: true,
    supportsTools: true,
    costRates: {
      inputPer1kTokens: 0.015,
      outputPer1kTokens: 0.075,
      source: "config",
      lastUpdated: Date.now(),
    },
    enabled: true,
  },

  // Ollama Models (local, no cost)
  {
    providerId: "ollama",
    modelId: "llama3.2",
    displayName: "Llama 3.2",
    contextWindow: 128_000,
    supportsStreaming: true,
    supportsTools: false,
    costRates: {
      inputPer1kTokens: 0,
      outputPer1kTokens: 0,
      source: "config",
      lastUpdated: Date.now(),
    },
    enabled: true,
    region: "local",
  },
  {
    providerId: "ollama",
    modelId: "mistral",
    displayName: "Mistral",
    contextWindow: 32_000,
    supportsStreaming: true,
    supportsTools: false,
    costRates: {
      inputPer1kTokens: 0,
      outputPer1kTokens: 0,
      source: "config",
      lastUpdated: Date.now(),
    },
    enabled: true,
    region: "local",
  },
];

// =============================================================================
// Default Alias Mappings
// =============================================================================

const DEFAULT_ALIAS_MAPPINGS: ModelAliasMapping[] = [
  // GPT-4 class
  {
    alias: "gpt-4",
    candidates: [
      { providerId: "openai", modelId: "gpt-4o", priority: 0 },
      { providerId: "openai", modelId: "gpt-4-turbo", priority: 1 },
    ],
    defaultStrategy: "cheapest",
    enabled: true,
  },
  {
    alias: "gpt-4o",
    candidates: [{ providerId: "openai", modelId: "gpt-4o", priority: 0 }],
    defaultStrategy: "pinned",
    enabled: true,
  },
  {
    alias: "gpt-4o-mini",
    candidates: [{ providerId: "openai", modelId: "gpt-4o-mini", priority: 0 }],
    defaultStrategy: "pinned",
    enabled: true,
  },

  // Claude class
  {
    alias: "claude-sonnet",
    candidates: [
      {
        providerId: "anthropic",
        modelId: "claude-3-5-sonnet-20241022",
        priority: 0,
      },
    ],
    defaultStrategy: "pinned",
    enabled: true,
  },
  {
    alias: "claude-haiku",
    candidates: [
      {
        providerId: "anthropic",
        modelId: "claude-3-5-haiku-20241022",
        priority: 0,
      },
    ],
    defaultStrategy: "pinned",
    enabled: true,
  },
  {
    alias: "claude-opus",
    candidates: [
      { providerId: "anthropic", modelId: "claude-3-opus-20240229", priority: 0 },
    ],
    defaultStrategy: "pinned",
    enabled: true,
  },

  // Best quality (cross-provider)
  {
    alias: "best",
    candidates: [
      { providerId: "anthropic", modelId: "claude-3-opus-20240229", priority: 0 },
      {
        providerId: "anthropic",
        modelId: "claude-3-5-sonnet-20241022",
        priority: 1,
      },
      { providerId: "openai", modelId: "gpt-4o", priority: 2 },
    ],
    defaultStrategy: "quality",
    enabled: true,
  },

  // Cheapest (cross-provider)
  {
    alias: "cheap",
    candidates: [
      { providerId: "ollama", modelId: "llama3.2", priority: 0 },
      { providerId: "openai", modelId: "gpt-4o-mini", priority: 1 },
      {
        providerId: "anthropic",
        modelId: "claude-3-5-haiku-20241022",
        priority: 2,
      },
    ],
    defaultStrategy: "cheapest",
    enabled: true,
  },

  // Local only
  {
    alias: "local",
    candidates: [
      { providerId: "ollama", modelId: "llama3.2", priority: 0 },
      { providerId: "ollama", modelId: "mistral", priority: 1 },
    ],
    defaultStrategy: "cheapest",
    enabled: true,
  },
];

// =============================================================================
// Configuration State
// =============================================================================

/** In-memory cache of model catalog */
let catalogCache: ModelCatalogEntry[] | null = null;

/** In-memory cache of alias mappings */
let aliasMappingsCache: Map<string, ModelAliasMapping> | null = null;

/** Flag indicating whether config has been validated */
let configValidated = false;

// =============================================================================
// Configuration Errors
// =============================================================================

export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly details: z.ZodError | string[]
  ) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

// =============================================================================
// Configuration API
// =============================================================================

/**
 * Initialize and validate routing configuration.
 * Call this at startup to fail fast on invalid config.
 *
 * @param catalog - Optional custom catalog (uses default if not provided)
 * @param aliases - Optional custom alias mappings (uses default if not provided)
 * @throws ConfigValidationError if configuration is invalid
 */
export function initializeRoutingConfig(
  catalog: ModelCatalogEntry[] = DEFAULT_CATALOG,
  aliases: ModelAliasMapping[] = DEFAULT_ALIAS_MAPPINGS
): void {
  // Validate catalog
  const catalogResult = ModelCatalogSchema.safeParse(catalog);
  if (!catalogResult.success) {
    throw new ConfigValidationError(
      "Invalid model catalog configuration",
      catalogResult.error
    );
  }

  // Validate alias mappings
  const aliasResult = AliasMappingsSchema.safeParse(aliases);
  if (!aliasResult.success) {
    throw new ConfigValidationError(
      "Invalid alias mapping configuration",
      aliasResult.error
    );
  }

  // Build lookup map for catalog
  const catalogMap = new Map<string, ModelCatalogEntry>();
  for (const entry of catalog) {
    const key = `${entry.providerId}:${entry.modelId}`;
    catalogMap.set(key, entry);
  }

  // Validate that all alias candidates reference existing catalog entries
  const errors: string[] = [];
  for (const mapping of aliases) {
    for (const candidate of mapping.candidates) {
      const key = `${candidate.providerId}:${candidate.modelId}`;
      if (!catalogMap.has(key)) {
        errors.push(
          `Alias "${mapping.alias}" references unknown model: ${key}`
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new ConfigValidationError(
      "Alias mappings reference unknown models",
      errors
    );
  }

  // Cache validated config
  catalogCache = catalog;
  aliasMappingsCache = new Map(aliases.map((m) => [m.alias, m]));
  configValidated = true;
}

/**
 * Get the model catalog.
 * @throws Error if config not initialized
 */
export function getModelCatalog(): ModelCatalogEntry[] {
  ensureInitialized();
  return catalogCache!;
}

/**
 * Get a model catalog entry by provider and model ID.
 */
export function getModelEntry(
  providerId: string,
  modelId: string
): ModelCatalogEntry | null {
  ensureInitialized();
  return (
    catalogCache!.find(
      (e) => e.providerId === providerId && e.modelId === modelId
    ) ?? null
  );
}

/**
 * Get alias mapping by alias name.
 */
export function getAliasMapping(alias: string): ModelAliasMapping | null {
  ensureInitialized();
  return aliasMappingsCache!.get(alias) ?? null;
}

/**
 * Get all alias mappings.
 */
export function getAllAliasMappings(): ModelAliasMapping[] {
  ensureInitialized();
  return Array.from(aliasMappingsCache!.values());
}

/**
 * Check if configuration has been initialized.
 */
export function isConfigInitialized(): boolean {
  return configValidated;
}

/**
 * Reset configuration (for testing).
 */
export function resetRoutingConfig(): void {
  catalogCache = null;
  aliasMappingsCache = null;
  configValidated = false;
}

// =============================================================================
// Internal Helpers
// =============================================================================

function ensureInitialized(): void {
  if (!configValidated) {
    // Auto-initialize with defaults
    initializeRoutingConfig();
  }
}

// =============================================================================
// Cost Rate Utilities
// =============================================================================

/**
 * Get cost rates for a specific model.
 */
export function getCostRates(
  providerId: string,
  modelId: string
): CostRates | null {
  const entry = getModelEntry(providerId, modelId);
  return entry?.costRates ?? null;
}

/**
 * Calculate total cost rate (input + output) for sorting.
 */
export function getTotalCostRate(rates: CostRates): number {
  return rates.inputPer1kTokens + rates.outputPer1kTokens;
}
