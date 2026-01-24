# Project B — Model Router & Cost/Policy Engine

> **Purpose**: Select the optimal model backend for each inference request based on cost, latency, capability, and policy constraints.

---

## Scope

### Owns
- Cross-provider model selection
- Alias → provider/model resolution
- Routing strategies (cheapest, fastest, quality, pinned)
- Fallback chains and ordering
- Hard constraints (context length, streaming, region/vendor allowlists)
- Pre- and post-inference cost accounting
- Tenant routing policy overlays
- Routing decision snapshots

### Does NOT Own
- Executing inference (Project A)
- Managing model lifecycle
- Hosting models
- Tenant authentication (Project C)
- Metrics aggregation (Project D)

---

## Interfaces

### Consumes
- Inference requests from Gateway (Project C)
- Provider capabilities from Runtime (Project A)
- Tenant routing policies from Gateway (Project C)

### Emits
- Routing decisions (provider + model + fallback chain)
- Cost estimates (pre-inference)
- Routing telemetry to Observability (Project D)

---

## Design Principles

1. **Deterministic routing** — Same input always produces same routing plan
2. **Snapshot decisions** — Routing plans are captured and replayable
3. **Policy-driven** — Constraints are explicit, not hardcoded
4. **Cost-aware** — Every decision considers cost implications
5. **Tenant-safe** — Tenant policies cannot bypass platform constraints

---

## Implementation Status

**Module Location:** `src/lib/routing/`

| File | Purpose | Status |
|------|---------|--------|
| `types.ts` | Type definitions | ✅ Complete |
| `config.ts` | Model catalog & alias mappings | ✅ Complete |
| `resolver.ts` | Alias resolution & candidate expansion | ✅ Complete |
| `selector.ts` | Strategy selection & routing flow | ✅ Complete |
| `cost.ts` | Cost estimation | ✅ Complete |
| `policy.ts` | Tenant policy management | ✅ Complete |
| `persistence.ts` | Database persistence (stubs) | ⏳ BLOCKED |
| `index.ts` | Public API exports | ✅ Complete |
| `__tests__/` | Unit tests (84 passing) | ✅ Complete |

---

## Database Schema Requirements

Project B requires the following Prisma schema additions:

### On `InferenceRequest` table (owned by Project A/C)

```prisma
model InferenceRequest {
  // ... existing fields from Project A/C

  /// Routing decision snapshot (JSON blob)
  /// Stores RoutingPlanSnapshot for replay/debugging
  routingSnapshot    Json?

  /// Actual cost after execution (JSON blob)
  /// Stores ActualCost for billing
  actualCost         Json?
}
```

### On `Tenant` table (owned by Project C)

```prisma
model Tenant {
  // ... existing fields from Project C

  /// Tenant-specific routing policy (JSON blob)
  /// Stores TenantRoutingPolicy for tenant-level constraints
  routingPolicy      Json?
}
```

> **Note:** These are JSON fields on tables owned by other projects.
> Project B does not create its own tables — it adds fields to existing tables.
> Coordinate with Project A/C when running migrations.

---

## Section Map

| Section | Purpose | Status |
|---------|---------|--------|
| B1 | Routing Primitives & Configuration | ✅ Complete |
| B2 | Alias Resolution & Candidate Selection | ✅ Complete |
| B3 | Fallback Logic & Decision Recording | ✅ Complete |
| B4 | Cost Estimation & Policy Engine | ✅ Complete |
| B5 | Validation & Testing | ✅ Complete (B5.6 blocked) |
| B6 | Database Schema & Persistence | ⏳ BLOCKED (needs Project A/C) |

---

## Deferred Features

| Feature | Reason | Dependency |
|---------|--------|------------|
| `fastest` routing strategy | Requires latency history | Project D (metrics) |
| Prisma persistence | Requires table ownership | Project A/C schema |
| Telemetry emission | Requires telemetry infrastructure | Project D |
| Live cost rate refresh | Requires background jobs | Infrastructure |
