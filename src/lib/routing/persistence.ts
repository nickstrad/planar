/**
 * Routing Persistence
 *
 * Database persistence for routing snapshots and actual costs.
 * Uses ExecutionRecord table (Project A) for storage.
 *
 * Note: Tenant policy persistence is still blocked pending Project C's Tenant table.
 */

import prisma from "@/lib/db";
import {
  RoutingPlanSnapshotSchema,
  ActualCostSchema,
  type RoutingPlanSnapshot,
  type ActualCost,
  type TenantRoutingPolicy,
} from "./types";
import { validatePolicy } from "./policy";

// =============================================================================
// Routing Snapshot Persistence (via ExecutionRecord)
// =============================================================================

/**
 * Persist routing snapshot to ExecutionRecord.
 *
 * @param requestId - The request ID (matches ExecutionRecord.requestId)
 * @param snapshot - The routing plan snapshot to persist
 */
export async function persistRoutingSnapshot(
  requestId: string,
  snapshot: RoutingPlanSnapshot,
): Promise<void> {
  await prisma.executionRecord.update({
    where: { requestId },
    data: { routingSnapshot: snapshot as object },
  });
}

/**
 * Load routing snapshot from ExecutionRecord.
 *
 * @param requestId - The request ID
 * @returns The routing snapshot or null if not found
 */
export async function loadRoutingSnapshot(
  requestId: string,
): Promise<RoutingPlanSnapshot | null> {
  const record = await prisma.executionRecord.findUnique({
    where: { requestId },
    select: { routingSnapshot: true },
  });

  if (!record?.routingSnapshot) return null;

  return RoutingPlanSnapshotSchema.parse(record.routingSnapshot);
}

// =============================================================================
// Actual Cost Persistence (via ExecutionRecord)
// =============================================================================

/**
 * Persist actual cost after execution completes.
 *
 * @param requestId - The request ID
 * @param cost - The actual cost data
 */
export async function persistActualCost(
  requestId: string,
  cost: ActualCost,
): Promise<void> {
  await prisma.executionRecord.update({
    where: { requestId },
    data: { actualCost: cost as object },
  });
}

/**
 * Load actual cost from ExecutionRecord.
 *
 * @param requestId - The request ID
 * @returns The actual cost or null if not found
 */
export async function loadActualCost(
  requestId: string,
): Promise<ActualCost | null> {
  const record = await prisma.executionRecord.findUnique({
    where: { requestId },
    select: { actualCost: true },
  });

  if (!record?.actualCost) return null;

  return ActualCostSchema.parse(record.actualCost);
}

// =============================================================================
// Tenant Routing Policy Persistence (BLOCKED: needs Project C Tenant table)
// =============================================================================

/**
 * Load tenant routing policy from database.
 *
 * BLOCKED: Requires Tenant.routingPolicy field (Project C)
 */
export async function loadTenantPolicyFromDb(
  tenantId: string,
): Promise<TenantRoutingPolicy | null> {
  // TODO: Enable when Tenant table exists (Project C)
  // const tenant = await prisma.tenant.findUnique({
  //   where: { id: tenantId },
  //   select: { routingPolicy: true },
  // });
  // if (!tenant?.routingPolicy) return null;
  // return validatePolicy(tenant.routingPolicy, tenantId);

  console.warn(
    `[routing/persistence] loadTenantPolicyFromDb: Tenant table not yet available. ` +
      `tenantId=${tenantId}`,
  );
  return null;
}

/**
 * Save tenant routing policy to database.
 *
 * BLOCKED: Requires Tenant.routingPolicy field (Project C)
 */
export async function saveTenantPolicyToDb(
  policy: TenantRoutingPolicy,
): Promise<void> {
  // TODO: Enable when Tenant table exists (Project C)
  // const validated = validatePolicy(policy, policy.tenantId);
  // await prisma.tenant.update({
  //   where: { id: policy.tenantId },
  //   data: { routingPolicy: validated },
  // });

  const validated = validatePolicy(policy, policy.tenantId);
  console.warn(
    `[routing/persistence] saveTenantPolicyToDb: Tenant table not yet available. ` +
      `tenantId=${validated.tenantId}`,
  );
}

// =============================================================================
// Availability Check
// =============================================================================

/**
 * Check if routing snapshot/cost persistence is available.
 * Returns true now that ExecutionRecord table exists.
 */
export function isSnapshotPersistenceAvailable(): boolean {
  return true;
}

/**
 * Check if tenant policy persistence is available.
 * Returns false until Project C creates Tenant table.
 */
export function isTenantPolicyPersistenceAvailable(): boolean {
  return false;
}
