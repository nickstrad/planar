# B5 — Validation & Testing

## Test Suite Overview

All tests located in `src/lib/routing/__tests__/`

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `config.test.ts` | 8 | Config validation, catalog loading |
| `resolver.test.ts` | 14 | Alias resolution, candidate expansion, filtering |
| `selector.test.ts` | 18 | Strategy selection, fallback chains, routing flow |
| `cost.test.ts` | 14 | Cost estimation, sorting, budget checks |
| `policy.test.ts` | 20 | Policy validation, merging, constraint extraction |
| **Total** | **84** | |

---

## B5.1 Routing validation (unit tests)

- [x] **B5.1.1 Test alias-to-provider resolution**
  - Valid alias resolves to candidates
  - Unknown alias returns null / throws AliasResolutionError
  - Disabled alias throws AliasResolutionError
  **Implementation:** `src/lib/routing/__tests__/resolver.test.ts:17-70`

- [x] **B5.1.2 Test fallback behavior with mock errors**
  - Fallback chain excludes primary
  - Respects maxCandidates limit
  - Maintains priority order
  **Implementation:** `src/lib/routing/__tests__/selector.test.ts:85-103`

- [x] **B5.1.3 Test provider availability gating**
  - Filtering by streaming requirement
  - Filtering by context length
  - Filtering by vendor allowlist
  **Implementation:** `src/lib/routing/__tests__/resolver.test.ts:72-145`

- [x] **B5.1.4 Test routing determinism**
  - Same input produces consistent snapshot
  - Strategy selection is deterministic
  - Priority preserved when costs equal
  **Implementation:** `src/lib/routing/__tests__/selector.test.ts:125-180`

---

## B5.2 Cost validation (unit tests)

- [x] **B5.2.1 Test pre-inference cost estimates**
  - Explicit output tokens
  - Estimated output tokens (50% of input)
  - Zero cost rates (free models)
  **Implementation:** `src/lib/routing/__tests__/cost.test.ts:24-56`

- [x] **B5.2.2 Test cheapest strategy selection**
  - Sorts by total cost rate
  - Preserves priority when costs equal
  - Respects cost cap filtering
  **Implementation:** `src/lib/routing/__tests__/cost.test.ts:66-130`

---

## B5.3 Tenant policy validation (unit tests)

- [x] **B5.3.1 Test tenant policy loading**
  - Store and retrieve policy
  - Return null for unknown tenant
  - Sync load from cache
  **Implementation:** `src/lib/routing/__tests__/policy.test.ts:47-68`

- [x] **B5.3.2 Test policy merge precedence**
  - Platform defaults apply
  - Tenant overrides preserved
  - Denied overrides allowed
  **Implementation:** `src/lib/routing/__tests__/policy.test.ts:84-108`

- [x] **B5.3.3 Test invalid policy rejection**
  - Invalid strategy rejected
  - Overlap between allowed/denied rejected
  - Preferred provider in denied list rejected
  **Implementation:** `src/lib/routing/__tests__/policy.test.ts:17-45`

---

## B5.4 Integration testing

- [x] **B5.4.1 Test routing → executor flow**
  - `route()` produces valid `RoutingPlanSnapshot`
  - Snapshot includes all required fields
  - Cost estimate attached
  **Implementation:** `src/lib/routing/__tests__/selector.test.ts:182-210`

- [x] **B5.4.2 Test error propagation**
  - Unknown alias throws AliasResolutionError
  - All candidates filtered throws PolicyConstraintError
  - Error types have correct `kind` field
  **Implementation:** `src/lib/routing/__tests__/selector.test.ts:212-240`

- [x] **B5.4.3 Test tenant policy application**
  - Tenant allowedProviders respected
  - Tenant deniedProviders filter candidates
  - Tenant cost cap enforced
  **Implementation:** `src/lib/routing/__tests__/selector.test.ts:242-275`

---

## B5.5 Edge case testing

- [x] **B5.5.1 Test empty candidate list**
  - All providers filtered → PolicyConstraintError
  - Error includes summary of filter reasons
  **Implementation:** `src/lib/routing/__tests__/selector.test.ts:226-240`

- [x] **B5.5.2 Test config validation at startup**
  - Invalid catalog entries rejected
  - Alias referencing unknown model rejected
  - ConfigValidationError thrown with details
  **Implementation:** `src/lib/routing/__tests__/config.test.ts:22-65`

- [x] **B5.5.3 Test tenant policy that eliminates all candidates**
  - Returns `PolicyConstraintError`
  - Error includes constraint details
  **Implementation:** `src/lib/routing/__tests__/selector.test.ts:254-275`

---

## Running Tests

```bash
# Run all routing tests
npx jest src/lib/routing/__tests__

# Run specific test file
npx jest src/lib/routing/__tests__/selector.test.ts

# Run with coverage
npx jest src/lib/routing/__tests__ --coverage
```

---

## Future Test Additions (BLOCKED)

> These tests are blocked pending dependencies from other projects.

- [ ] **B5.6.1 Test snapshot persistence to Prisma**
  - **BLOCKED:** Requires `InferenceRequest` table from Project A
  - Stub implementation in `persistence.ts` logs warnings until table exists
  - Will test: persist snapshot, load snapshot, verify JSON structure

- [ ] **B5.6.2 Test telemetry emission**
  - **BLOCKED:** Requires telemetry infrastructure from Project D
  - Will test: emit routing_decision event with snapshot ID
  - Will test: emit fallback_triggered events

- [ ] **B5.6.3 Load testing**
  - **DEFERRED:** Lower priority, can be done after core functionality
  - Will test: routing throughput under high concurrency
  - Will test: memory usage with large candidate lists
