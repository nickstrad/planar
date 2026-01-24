# B3 — Fallback Logic & Decision Recording

## B3.1 Fallback chain construction

- [x] **B3.1.1 Build fallback chain from candidates**
  - Order remaining candidates after primary by priority
  - Limit to `fallbackConfig.maxCandidates` (default: 3)
  ```typescript
  function buildFallbackChain(
    candidates: FilteredCandidate[],
    primary: FilteredCandidate,
    maxCandidates: number
  ): ResolvedProvider[]
  ```
  **Implementation:** `src/lib/routing/selector.ts:95-114`

- [x] **B3.1.2 Use Project A error classification**
  - Import `shouldFallback()` from `@/lib/inference/types`
  - Import `isRetryableError()` for same-provider retry
  - Do NOT redefine error taxonomy
  - Re-export from routing module for consumer convenience
  **Implementation:** `src/lib/routing/types.ts:17`

- [x] **B3.1.3 Define `FallbackConfig`**
  ```typescript
  interface FallbackConfig {
    maxAttempts: number;        // Default: 3
    totalTimeoutMs: number;     // Default: 120_000 (2 min)
    maxCandidates: number;      // Max fallback chain length, default: 3
  }

  const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
    maxAttempts: 3,
    totalTimeoutMs: 120_000,
    maxCandidates: 3,
  };
  ```
  **Implementation:** `src/lib/routing/types.ts:216-231`

- [x] **B3.1.4 Define exhaustion behavior**
  ```typescript
  interface FallbackExhaustedError {
    kind: 'fallback_exhausted';
    attemptedProviders: ResolvedProvider[];
    lastError: ExecutionError;
    message: string;
  }
  ```
  **Implementation:** `src/lib/routing/types.ts:233-253`

---

## B3.2 Decision recording

- [x] **B3.2.1 Persist routing snapshot**
  - Store `RoutingPlanSnapshot` as JSON in `InferenceRequest.routingSnapshot`
  - Snapshot includes: snapshotId, strategy, resolvedAlias, candidateCount, timestamp, costEstimate, tenantId
  - TODO: Add Prisma migration if field doesn't exist
  **Implementation:** `src/lib/routing/types.ts:258-277`, `src/lib/routing/selector.ts:310-370`

- [x] **B3.2.2 Record fallback decisions**
  ```typescript
  interface FallbackRecord {
    attemptNumber: number;
    provider: ResolvedProvider;
    error: ExecutionError;
    timestamp: number;
  }
  ```
  **Implementation:** `src/lib/routing/types.ts:255-268`

- [x] **B3.2.3 Emit routing telemetry**
  - Use `TelemetryEmitter` interface from Project A types
  - TODO: Emit `routing_decision` event with snapshot ID
  **Note:** Telemetry emission will be added when integrating with Project D

---

## B3.3 Tenant-aware routing hooks

- [x] **B3.3.1 Accept tenantId in `RoutingInput`**
  - Already defined in B1.1.1
  **Implementation:** `src/lib/routing/types.ts:47`

- [x] **B3.3.2 Define `TenantRoutingPolicy`**
  ```typescript
  interface TenantRoutingPolicy {
    tenantId: string;
    allowedProviders?: string[];   // Empty = allow all
    deniedProviders?: string[];    // Overrides allowed
    preferredProvider?: string;    // Soft preference
    maxCostPerRequestUsd?: number;
    defaultStrategy?: RoutingStrategy;
  }
  ```
  **Implementation:** `src/lib/routing/types.ts:283-304`

- [x] **B3.3.3 Load tenant policies from cache/Prisma**
  - Query `Tenant.routingPolicy` JSON field (TODO: Prisma integration)
  - Return null if no custom policy
  - In-memory cache for loaded policies
  ```typescript
  async function loadTenantPolicy(tenantId: string): Promise<TenantRoutingPolicy | null>
  function loadTenantPolicySync(tenantId: string): TenantRoutingPolicy | null
  function setTenantPolicy(policy: TenantRoutingPolicy): void
  ```
  **Implementation:** `src/lib/routing/policy.ts:40-85`

- [x] **B3.3.4 Merge base config with tenant overrides**
  - Precedence: tenant deny > tenant allow > platform defaults
  - Tenant cannot enable providers disabled at platform level
  ```typescript
  function mergeWithPlatformDefaults(
    tenantPolicy: TenantRoutingPolicy | null
  ): TenantRoutingPolicy
  ```
  **Implementation:** `src/lib/routing/policy.ts:152-174`

- [x] **B3.3.5 Validate tenant policies**
  - Zod schema for `TenantRoutingPolicy`
  - Reject unknown provider IDs
  - Reject overlap between allowed and denied
  - Reject preferred provider in denied list
  ```typescript
  function validatePolicy(data: unknown, tenantId: string): TenantRoutingPolicy
  ```
  **Implementation:** `src/lib/routing/policy.ts:93-140`
