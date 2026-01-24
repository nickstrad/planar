# B4 — Cost Estimation & Policy Engine

## B4.1 Cost modeling

- [x] **B4.1.1 Define `CostEstimate`**
  ```typescript
  interface CostEstimate {
    inputTokens: number;
    estimatedOutputTokens: number;
    inputCostUsd: number;
    estimatedOutputCostUsd: number;
    totalEstimateUsd: number;
    provider: ResolvedProvider;
  }
  ```
  **Implementation:** `src/lib/routing/types.ts:310-332`

- [x] **B4.1.2 Estimate pre-inference cost**
  - Input cost = `inputTokens / 1000 * inputPer1kTokens`
  - Output estimate = use `maxTokens` if specified, else `inputTokens * 0.5`
  - Return `CostEstimate`
  ```typescript
  function estimateCost(
    inputTokens: number,
    maxOutputTokens: number | undefined,
    costRates: CostRates,
    provider: ResolvedProvider
  ): CostEstimate
  ```
  **Implementation:** `src/lib/routing/cost.ts:17-39`

- [x] **B4.1.3 Calculate post-inference cost**
  ```typescript
  interface ActualCost {
    inputTokens: number;
    outputTokens: number;
    inputCostUsd: number;
    outputCostUsd: number;
    totalCostUsd: number;
    provider: ResolvedProvider;
  }

  function calculateActualCost(
    inputTokens: number,
    outputTokens: number,
    costRates: CostRates,
    provider: ResolvedProvider
  ): ActualCost
  ```
  **Implementation:** `src/lib/routing/types.ts:334-355`, `src/lib/routing/cost.ts:41-58`

- [x] **B4.1.4 Define cost rate refresh strategy**
  - Static config source for v1
  - `CostRates.source: 'config' | 'api'`
  - `CostRates.lastUpdated` for future API refresh
  - TODO: Add background job to refresh from provider APIs
  **Implementation:** `src/lib/routing/types.ts:77-93`

---

## B4.2 Policy constraints

- [x] **B4.2.1 Define hard constraint types**
  ```typescript
  interface HardConstraints {
    maxContextLength?: number;
    streamingRequired: boolean;
    regionAllowlist?: string[];
    vendorAllowlist?: string[];
  }
  ```
  **Implementation:** `src/lib/routing/types.ts:361-376`

- [x] **B4.2.2 Define soft constraint types**
  ```typescript
  interface SoftConstraints {
    preferredStrategy: RoutingStrategy;
    maxCostUsd?: number;
    preferredProvider?: string;
  }
  ```
  **Implementation:** `src/lib/routing/types.ts:378-392`

- [x] **B4.2.3 Define constraint precedence**
  - Hard constraints: eliminate candidates (binary pass/fail)
  - Soft constraints: rank candidates (applied during selection)
  - Precedence: explicit request > tenant policy > platform default
  ```typescript
  type ConstraintSource = 'request' | 'tenant' | 'platform';
  ```
  **Implementation:** `src/lib/routing/types.ts:394-401`, `src/lib/routing/selector.ts:116-137`

---

## B4.3 Cost-aware routing

- [x] **B4.3.1 Include cost in routing decision**
  - Attach `CostEstimate` to `RoutingPlanSnapshot`
  - Cost calculation occurs during `route()` execution
  **Implementation:** `src/lib/routing/selector.ts:336-342`

- [x] **B4.3.2 Enforce tenant cost caps**
  - Check `maxCostPerRequestUsd` from tenant policy
  - Check `maxCostUsd` from request constraints
  - Return `PolicyConstraintError` if all candidates exceed cap
  ```typescript
  function filterByCostCap(
    candidates: FilteredCandidate[],
    maxCostUsd: number,
    inputTokens: number,
    maxOutputTokens: number | undefined
  ): FilteredCandidate[]

  function getEffectiveCostCap(
    input: RoutingInput,
    policy: TenantRoutingPolicy | null
  ): number | undefined
  ```
  **Implementation:** `src/lib/routing/cost.ts:78-108`, `src/lib/routing/policy.ts:230-246`

- [x] **B4.3.3 Emit cost estimates in routing response**
  - Include in `RoutingPlanSnapshot.costEstimate`
  - Accessible via `route()` return value
  **Implementation:** `src/lib/routing/selector.ts:336-342`

---

## PolicyConstraintError

When policy constraints eliminate all candidates:

```typescript
interface PolicyConstraintError {
  kind: 'policy_constraint';
  message: string;
  constraint: string;  // Summary of filter reasons
  tenantId: string;
}
```

**Implementation:** `src/lib/routing/types.ts:403-419`
