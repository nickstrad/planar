# B1 — Routing Primitives & Configuration

## B1.1 Routing input context

- [x] **B1.1.1 Define `RoutingInput` type**
  ```typescript
  interface RoutingInput {
    tenantId: string;
    modelAlias: string;
    streamRequired: boolean;
    estimatedInputTokens: number;
    maxOutputTokens?: number;
    constraints?: RoutingConstraints;
    strategy?: RoutingStrategy;
  }

  interface RoutingConstraints {
    maxContextLength?: number;
    regionAllowlist?: string[];
    vendorAllowlist?: string[];
    maxCostUsd?: number;
    pinnedProvider?: { providerId: string; modelId: string };
  }
  ```
  **Implementation:** `src/lib/routing/types.ts`

- [x] **B1.1.2 Use `ResolvedProvider` from Project A**
  - Import from `@/lib/inference/types`
  - Re-export from routing module for consumers
  **Implementation:** `src/lib/routing/types.ts:13-17`

- [x] **B1.1.3 Define `RoutingPlanSnapshot`**
  ```typescript
  interface RoutingPlanSnapshot extends RoutingPlan {
    snapshotId: string;
    strategy: RoutingStrategy;
    resolvedAlias: string;
    candidateCount: number;
    timestamp: number;
    costEstimate: CostEstimate;
    tenantId: string;
  }

  type RoutingStrategy = 'cheapest' | 'quality' | 'pinned';
  // Note: 'fastest' deferred — requires latency history infrastructure
  ```
  **Implementation:** `src/lib/routing/types.ts:233-256`

---

## B1.2 Model catalog configuration

- [x] **B1.2.1 Define `ModelCatalogEntry`**
  ```typescript
  interface ModelCatalogEntry {
    providerId: string;
    modelId: string;
    displayName: string;
    contextWindow: number;
    supportsStreaming: boolean;
    supportsTools: boolean;
    costRates: CostRates;
    enabled: boolean;
    region?: string;
  }

  interface CostRates {
    inputPer1kTokens: number;   // USD
    outputPer1kTokens: number;  // USD
    source: 'config' | 'api';
    lastUpdated: number;
  }
  ```
  **Implementation:** `src/lib/routing/types.ts:72-111`

- [x] **B1.2.2 Define `ModelAliasMapping`**
  ```typescript
  interface ModelAliasMapping {
    alias: string;
    candidates: CandidateRef[];
    defaultStrategy: RoutingStrategy;
    enabled: boolean;
  }

  interface CandidateRef {
    providerId: string;
    modelId: string;
    priority: number;  // Lower = higher priority in fallback chain
  }
  ```
  **Implementation:** `src/lib/routing/types.ts:113-137`

- [x] **B1.2.3 Create routing config module**
  - Export `getModelCatalog(): ModelCatalogEntry[]`
  - Export `getAliasMapping(alias: string): ModelAliasMapping | null`
  - Marked as server-only module
  - Default catalog includes OpenAI, Anthropic, and Ollama models
  **Implementation:** `src/lib/routing/config.ts`

- [x] **B1.2.4 Validate routing config at startup**
  - Zod schema for `ModelCatalogEntry[]` and `ModelAliasMapping[]`
  - Fail fast if alias references unknown provider/model
  - `initializeRoutingConfig()` validates and caches configuration
  **Implementation:** `src/lib/routing/config.ts:217-270`

---

## B1.3 Provider capability registry

- [x] **B1.3.1 Extend `ProviderCapabilities` with model data**
  ```typescript
  interface ModelCapabilities extends ProviderCapabilities {
    providerId: string;
    modelId: string;
    contextWindow: number;
    // supportsStreaming, supportsTools inherited from ProviderCapabilities
  }
  ```
  **Implementation:** `src/lib/routing/types.ts:143-154`

- [x] **B1.3.2 Query capabilities from catalog**
  - Load from static config (not live API for now)
  - Cache in-memory on startup via `initializeRoutingConfig()`
  - TODO: integrate with Project A health checks
  **Implementation:** `src/lib/routing/config.ts`, `src/lib/routing/resolver.ts:50-80`

- [x] **B1.3.3 Enforce capability gating**
  - Filter candidates where `!supportsStreaming` if `streamRequired`
  - Filter candidates where `contextWindow < estimatedInputTokens`
  **Implementation:** `src/lib/routing/resolver.ts:90-143`
