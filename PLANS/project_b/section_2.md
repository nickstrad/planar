# B2 — Alias Resolution & Candidate Selection

## B2.1 Alias resolution

- [x] **B2.1.1 Resolve alias to candidate list**
  ```typescript
  function resolveAlias(alias: string): CandidateRef[] | null
  function resolveAliasOrThrow(alias: string): CandidateRef[]
  ```
  **Implementation:** `src/lib/routing/resolver.ts:22-49`

- [x] **B2.1.2 Define `AliasResolutionError`**
  ```typescript
  interface AliasResolutionError {
    kind: 'unknown_alias' | 'disabled_alias' | 'no_candidates';
    alias: string;
    message: string;
  }
  ```
  **Implementation:** `src/lib/routing/types.ts:160-175`

- [x] **B2.1.3 Enforce alias validity**
  - Throw `AliasResolutionError` for unknown/disabled aliases
  - Log warning for aliases with no enabled candidates
  **Implementation:** `src/lib/routing/resolver.ts:32-49`

---

## B2.2 Candidate filtering

- [x] **B2.2.1 Define `FilteredCandidate`**
  ```typescript
  interface FilteredCandidate {
    providerId: string;
    modelId: string;
    capabilities: ModelCapabilities;
    costRates: CostRates;
    filtered: boolean;
    filterReason?: string;  // Why excluded
    priority: number;
  }
  ```
  **Implementation:** `src/lib/routing/types.ts:188-210`

- [x] **B2.2.2 Enforce stream compatibility**
  - Set `filtered: true, filterReason: 'no_streaming'` if mismatch
  **Implementation:** `src/lib/routing/resolver.ts:103-111`

- [x] **B2.2.3 Enforce context length constraints**
  - Set `filtered: true, filterReason: 'context_too_small'` if mismatch
  **Implementation:** `src/lib/routing/resolver.ts:113-123`

- [x] **B2.2.4 Apply region/vendor allowlists**
  ```typescript
  interface AllowlistConstraint {
    type: 'region' | 'vendor';
    allowed: string[];  // Empty = allow all
  }
  ```
  - Filter `vendor_not_allowed` for vendor mismatch
  - Filter `region_not_allowed` for region mismatch
  **Implementation:** `src/lib/routing/types.ts:181-185`, `src/lib/routing/resolver.ts:125-143`

---

## B2.3 Primary candidate selection

- [x] **B2.3.1 Implement cheapest strategy**
  - Sort by `costRates.inputPer1kTokens + costRates.outputPer1kTokens`
  - Select first non-filtered candidate
  ```typescript
  function selectCheapest(candidates: FilteredCandidate[]): FilteredCandidate | null
  ```
  **Implementation:** `src/lib/routing/selector.ts:21-32`

- [x] **B2.3.2 Defer fastest strategy**
  - Marked as TODO: requires latency history infrastructure
  - Falls back to `cheapest` if selected
  - RoutingStrategy type only includes: 'cheapest' | 'quality' | 'pinned'
  **Note:** Fastest strategy will require latency data collection (Project D integration)

- [x] **B2.3.3 Implement quality strategy**
  - Sort by `contextWindow` descending (larger = more capable)
  - Consider adding quality tier to `ModelCatalogEntry` later
  ```typescript
  function selectQuality(candidates: FilteredCandidate[]): FilteredCandidate | null
  ```
  **Implementation:** `src/lib/routing/selector.ts:34-52`

- [x] **B2.3.4 Implement pinned strategy**
  - Accept explicit `providerId + modelId` in constraints
  - Validate exists and is enabled
  ```typescript
  function selectPinned(
    candidates: FilteredCandidate[],
    providerId: string,
    modelId: string
  ): FilteredCandidate | null
  ```
  **Implementation:** `src/lib/routing/selector.ts:54-68`

- [x] **B2.3.5 Select primary candidate**
  ```typescript
  function selectPrimary(
    candidates: FilteredCandidate[],
    strategy: RoutingStrategy,
    pinnedProvider?: { providerId: string; modelId: string }
  ): FilteredCandidate | null
  ```
  **Implementation:** `src/lib/routing/selector.ts:70-93`

---

## Constraint Precedence

Constraint resolution follows this precedence order:
1. **Explicit request constraints** — from `RoutingInput.constraints` and `RoutingInput.strategy`
2. **Tenant policy constraints** — from `TenantRoutingPolicy`
3. **Alias default strategy** — from `ModelAliasMapping.defaultStrategy`
4. **Platform defaults** — `cheapest` strategy

**Implementation:** `src/lib/routing/selector.ts:116-137`
