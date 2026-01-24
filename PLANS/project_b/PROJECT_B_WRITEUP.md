# Project B Code Walkthrough — Model Router & Cost/Policy Engine

This document walks through the code changes for Project B in logical dependency order. Each file builds on the previous, culminating in a complete routing system.

---

## 0. `src/lib/common/types.ts` (New Module)

The shared foundation for all projects. Contains types used by both Project A (Inference) and Project B (Routing): `ResolvedProvider`, `RoutingPlan`, `ExecutionError`, `ErrorKind`, `ProviderCapabilities`, plus error classification functions `shouldFallback()` and `isRetryableError()`.

Both Project A and Project B import from here. This avoids circular dependencies and establishes clear ownership of cross-cutting types. The common module has its own `index.ts` barrel file.

---

## 1. `src/lib/routing/types.ts`

The foundation of Project B. Defines all TypeScript interfaces and types used throughout the routing module. Imports shared types from `@/lib/common/types` (`ResolvedProvider`, `RoutingPlan`, `ExecutionError`, `ProviderCapabilities`).

Key types defined here include `RoutingInput` (what comes in), `RoutingPlanSnapshot` (what gets persisted), `ModelCatalogEntry` (provider/model metadata), `TenantRoutingPolicy` (per-tenant overrides), and the three error types (`AliasResolutionError`, `FallbackExhaustedError`, `PolicyConstraintError`). Every subsequent file imports from this one.

---

## 2. `src/lib/routing/config.ts`

Configuration loader for the model catalog and alias mappings. Uses Zod schemas to validate configuration at startup, failing fast if aliases reference unknown providers or if cost rates are malformed.

Provides the foundation data that resolver and selector need: `getModelCatalog()` returns all available models with their capabilities and cost rates, while `getAliasMapping()` maps friendly names like `"gpt-4"` to lists of provider/model candidates. The `initializeRoutingConfig()` function must be called at app startup to populate the validated cache.

---

## 3. `src/lib/routing/resolver.ts`

Translates model aliases into concrete candidate lists and filters them by hard constraints. `resolveAliasOrThrow()` takes an alias string and returns candidate references, throwing typed errors for unknown or disabled aliases.

`expandCandidates()` enriches references with full model capabilities from the config, while `applyHardConstraints()` filters out candidates that don't meet requirements (streaming support, context length, region/vendor allowlists). The output is a list of `FilteredCandidate` objects ready for strategy-based selection.

---

## 4. `src/lib/routing/cost.ts`

Pure cost calculation utilities with no external dependencies beyond types. `estimateCost()` computes pre-inference cost estimates using token counts and cost rates, while `calculateActualCost()` computes final costs after execution completes.

Also provides sorting and filtering helpers: `sortByCost()` orders candidates by total cost rate, `filterByCostCap()` removes candidates exceeding a budget, and `findCheapest()` is a convenience wrapper. These functions are used by the selector to implement the `cheapest` routing strategy.

---

## 5. `src/lib/routing/policy.ts`

Tenant-specific routing policy management. Policies allow tenants to restrict which providers they use (`allowedProviders`/`deniedProviders`), set cost caps, or override the default routing strategy. Uses Zod for validation with conflict detection (e.g., provider in both allow and deny lists).

Provides an in-memory cache via `loadTenantPolicy()`/`setTenantPolicy()` with async loading support for future database integration. `mergeWithPlatformDefaults()` combines tenant preferences with system defaults using defined precedence rules. The `isProviderAllowed()` helper is used by the selector to enforce tenant restrictions.

---

## 6. `src/lib/routing/selector.ts`

The brain of the routing system — implements strategy selection and the main `route()` function. Offers three selection strategies: `selectCheapest()` (lowest cost), `selectQuality()` (largest context window), and `selectPinned()` (explicit provider/model).

The `route()` function is the primary entry point: it resolves aliases, applies constraints, selects a primary candidate, builds a fallback chain from remaining candidates, estimates cost, and returns a complete `RoutingPlanSnapshot`. Also handles tenant policy application via `applyTenantPolicy()` which filters candidates and determines effective strategy.

---

## 7. `src/lib/routing/persistence.ts`

Database persistence layer using Prisma. Stores routing snapshots and actual costs as JSON fields on the `ExecutionRecord` table (owned by Project A). `persistRoutingSnapshot()` saves the routing decision for debugging/replay, while `persistActualCost()` records final billing data.

Tenant policy persistence functions (`loadTenantPolicyFromDb`, `saveTenantPolicyToDb`) are stubbed with console warnings — they require Project C's `Tenant` table which doesn't exist yet. Availability check functions let callers know which persistence features are ready.

---

## 8. `src/lib/routing/index.ts`

Public API barrel file that re-exports everything consumers need. Organized into sections: Types, Configuration, Resolution, Selection, Cost, Policy, and Persistence. This is the only file external code should import from.

Consumers import like `import { route, RoutingInput, estimateCost } from "@/lib/routing"` rather than reaching into internal modules. This allows internal refactoring without breaking external code.

---

## 9. `prisma/schema.prisma`

Adds two new tables for Project A's execution tracking, with Project B fields embedded. `ExecutionRecord` stores per-request outcomes and includes `routingSnapshot` (JSON) and `actualCost` (JSON) fields for Project B's persistence layer.

`ExecutionAttempt` tracks individual provider attempts within a request, enabling fallback analysis. Both tables use `requestId` as the linking key. The JSON field approach was chosen for schema flexibility — routing snapshots can evolve without migrations.

---

## Dependency Graph

```
common/types.ts (shared)
    ↓
routing/types.ts
    ↓
config.ts ← resolver.ts ← selector.ts → route()
    ↓           ↓              ↓
cost.ts ←──────┴──────────────┘

policy.ts ──────────────────→ selector.ts

persistence.ts ← prisma/schema.prisma

index.ts ← (re-exports all)
```

---

## Files Not Covered

- `src/lib/common/index.ts` — Barrel file for common module
- `__tests__/*.test.ts` — Unit tests (84 routing + 87 inference = 171 total)
- `PLANS/project_b/*.md` — Specification documents
