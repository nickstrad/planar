# B6 — Database Schema & Persistence

> **Status:** PARTIALLY COMPLETE
> - ✅ Routing snapshot & cost persistence (via `ExecutionRecord` from Project A)
> - ⏳ Tenant policy persistence (blocked on Project C `Tenant` table)
>
> **Implementation:** `src/lib/routing/persistence.ts`

## Overview

Project B does not own any tables. Instead, it adds JSON fields to tables owned by other projects:

| Field | Table | Owner | Status |
|-------|-------|-------|--------|
| `routingSnapshot` | `ExecutionRecord` | Project A | ✅ Implemented |
| `actualCost` | `ExecutionRecord` | Project A | ✅ Implemented |
| `routingPolicy` | `Tenant` | Project C | ⏳ Blocked |

---

## B6.1 Routing Snapshot Persistence ✅

### B6.1.1 Schema Addition

```prisma
// Added to ExecutionRecord model in prisma/schema.prisma

model ExecutionRecord {
  // ... Project A fields ...

  /// JSON blob containing RoutingPlanSnapshot
  /// Stores: snapshotId, strategy, resolvedAlias, candidateCount,
  ///         timestamp, costEstimate, tenantId, primary, fallbacks
  routingSnapshot    Json?
}
```

### B6.1.2 TypeScript Integration ✅

```typescript
// src/lib/routing/persistence.ts

import prisma from "@/lib/db";
import type { RoutingPlanSnapshot } from "./types";

/**
 * Persist routing snapshot to ExecutionRecord.
 */
export async function persistRoutingSnapshot(
  requestId: string,
  snapshot: RoutingPlanSnapshot
): Promise<void> {
  await prisma.executionRecord.update({
    where: { requestId },
    data: { routingSnapshot: snapshot as object },
  });
}

/**
 * Load routing snapshot from ExecutionRecord.
 */
export async function loadRoutingSnapshot(
  requestId: string
): Promise<RoutingPlanSnapshot | null> {
  const record = await prisma.executionRecord.findUnique({
    where: { requestId },
    select: { routingSnapshot: true },
  });

  if (!record?.routingSnapshot) return null;

  return record.routingSnapshot as unknown as RoutingPlanSnapshot;
}
```

---

## B6.2 Actual Cost Persistence ✅

### B6.2.1 Schema Addition

```prisma
// Added to ExecutionRecord model in prisma/schema.prisma

model ExecutionRecord {
  // ... Project A fields ...

  /// JSON blob containing ActualCost
  /// Stores: inputTokens, outputTokens, inputCostUsd, outputCostUsd,
  ///         totalCostUsd, provider
  actualCost         Json?
}
```

### B6.2.2 TypeScript Integration ✅

```typescript
// src/lib/routing/persistence.ts

import type { ActualCost } from "./types";

/**
 * Persist actual cost after execution completes.
 */
export async function persistActualCost(
  requestId: string,
  cost: ActualCost
): Promise<void> {
  await prisma.executionRecord.update({
    where: { requestId },
    data: { actualCost: cost as object },
  });
}

/**
 * Load actual cost from ExecutionRecord.
 */
export async function loadActualCost(
  requestId: string
): Promise<ActualCost | null> {
  const record = await prisma.executionRecord.findUnique({
    where: { requestId },
    select: { actualCost: true },
  });

  if (!record?.actualCost) return null;

  return record.actualCost as unknown as ActualCost;
}
```

---

## B6.3 Tenant Routing Policy Persistence

### B6.3.1 Schema Addition

```prisma
// Add to Tenant model in prisma/schema.prisma (Project C owns this table)

model Tenant {
  // ... existing fields from Project C

  /// JSON blob containing TenantRoutingPolicy
  /// Stores: allowedProviders, deniedProviders, preferredProvider,
  ///         maxCostPerRequestUsd, defaultStrategy
  routingPolicy      Json?
}
```

### B6.3.2 TypeScript Integration

```typescript
// Update src/lib/routing/policy.ts

import { prisma } from "@/lib/db";
import type { TenantRoutingPolicy } from "./types";
import { validatePolicy } from "./policy";

/**
 * Load tenant routing policy from database.
 */
export async function loadTenantPolicyFromDb(
  tenantId: string
): Promise<TenantRoutingPolicy | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { routingPolicy: true },
  });

  if (!tenant?.routingPolicy) return null;

  // Validate and return
  return validatePolicy(tenant.routingPolicy, tenantId);
}

/**
 * Save tenant routing policy to database.
 */
export async function saveTenantPolicy(
  policy: TenantRoutingPolicy
): Promise<void> {
  const validated = validatePolicy(policy, policy.tenantId);

  await prisma.tenant.update({
    where: { id: policy.tenantId },
    data: { routingPolicy: validated as unknown as Prisma.JsonValue },
  });
}
```

---

## B6.4 Migration Checklist

- [x] **B6.4.1 Add routing fields to ExecutionRecord** ✅
  - Added `routingSnapshot` and `actualCost` JSON fields to `ExecutionRecord`
  - Schema location: `prisma/schema.prisma`

- [ ] **B6.4.2 Coordinate with Project C on Tenant table** ⏳ BLOCKED
  - Waiting for Project C to create `Tenant` table
  - Will add `routingPolicy` JSON field

- [x] **B6.4.3 Generate Prisma client** ✅
  ```bash
  npx prisma generate
  ```

- [ ] **B6.4.4 Run migration** (when deploying)
  ```bash
  npx prisma migrate dev --name add_execution_tables
  ```

- [x] **B6.4.5 Implement persistence module** ✅
  - `src/lib/routing/persistence.ts` with real Prisma code
  - Snapshot/cost persistence: fully working
  - Tenant policy persistence: still stubbed (needs Project C)

---

## B6.5 Testing Persistence

- [ ] **B6.5.1 Test snapshot persistence** (Ready after migration)
  - Persist snapshot and verify JSON structure
  - Load snapshot and verify type safety

- [ ] **B6.5.2 Test cost persistence** (Ready after migration)
  - Persist actual cost after execution
  - Verify cost data integrity

- [ ] **B6.5.3 Test policy persistence** ⏳ BLOCKED
  - Save and load tenant policies
  - Verify validation on load
  - Requires Project C `Tenant` table

---

## Notes

1. **JSON vs Relational**: Using JSON fields for these structures because:
   - Flexible schema evolution
   - Single-row atomic updates
   - No joins needed for routing flow
   - Snapshots are read-only after creation

2. **Validation**: Always validate JSON on load using Zod schemas to catch schema drift.

3. **Migration Safety**: These are additive changes (new nullable fields) — safe to deploy without downtime.
