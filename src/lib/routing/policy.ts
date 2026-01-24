/**
 * Tenant Routing Policy
 *
 * Loading, validation, and merging of tenant-specific routing policies.
 */

import { z } from "zod";
import { ROUTING_STRATEGY, RoutingStrategySchema } from "./types";
import type {
  TenantRoutingPolicy,
  RoutingStrategy,
  SoftConstraints,
  HardConstraints,
  RoutingInput,
} from "./types";

// =============================================================================
// Policy Validation Schema
// =============================================================================

export const TenantRoutingPolicySchema = z.object({
  tenantId: z.string().min(1),
  allowedProviders: z.array(z.string().min(1)).optional(),
  deniedProviders: z.array(z.string().min(1)).optional(),
  preferredProvider: z.string().min(1).optional(),
  maxCostPerRequestUsd: z.number().positive().optional(),
  defaultStrategy: RoutingStrategySchema.optional(),
});

// =============================================================================
// Policy Loading
// =============================================================================

/**
 * In-memory cache for tenant policies.
 * In production, this would be loaded from Prisma.
 */
const policyCache = new Map<string, TenantRoutingPolicy>();

/**
 * Load tenant routing policy.
 *
 * @param tenantId - The tenant to load policy for
 * @returns The tenant policy or null if no custom policy exists
 *
 * TODO: Integrate with Prisma to load from Tenant.routingPolicy JSON field
 */
export async function loadTenantPolicy(
  tenantId: string
): Promise<TenantRoutingPolicy | null> {
  // Check cache first
  const cached = policyCache.get(tenantId);
  if (cached) {
    return cached;
  }

  // TODO: Load from Prisma
  // const tenant = await prisma.tenant.findUnique({
  //   where: { id: tenantId },
  //   select: { routingPolicy: true }
  // });
  // if (tenant?.routingPolicy) {
  //   const policy = validatePolicy(tenant.routingPolicy, tenantId);
  //   policyCache.set(tenantId, policy);
  //   return policy;
  // }

  return null;
}

/**
 * Load tenant routing policy synchronously from cache.
 * Returns null if not in cache.
 */
export function loadTenantPolicySync(
  tenantId: string
): TenantRoutingPolicy | null {
  return policyCache.get(tenantId) ?? null;
}

/**
 * Set a tenant policy in cache (for testing or direct updates).
 */
export function setTenantPolicy(policy: TenantRoutingPolicy): void {
  const validated = validatePolicy(policy, policy.tenantId);
  policyCache.set(validated.tenantId, validated);
}

/**
 * Clear a tenant policy from cache.
 */
export function clearTenantPolicy(tenantId: string): void {
  policyCache.delete(tenantId);
}

/**
 * Clear all cached policies (for testing).
 */
export function clearAllPolicies(): void {
  policyCache.clear();
}

// =============================================================================
// Policy Validation
// =============================================================================

export class PolicyValidationError extends Error {
  constructor(
    message: string,
    public readonly tenantId: string,
    public readonly details: z.ZodError | string
  ) {
    super(message);
    this.name = "PolicyValidationError";
  }
}

/**
 * Validate a tenant routing policy.
 *
 * @param data - Raw policy data
 * @param tenantId - Expected tenant ID
 * @returns Validated policy
 * @throws PolicyValidationError if validation fails
 */
export function validatePolicy(
  data: unknown,
  tenantId: string
): TenantRoutingPolicy {
  // Ensure tenantId matches
  const withTenantId = { ...(data as object), tenantId };

  const result = TenantRoutingPolicySchema.safeParse(withTenantId);

  if (!result.success) {
    throw new PolicyValidationError(
      `Invalid tenant routing policy for tenant ${tenantId}`,
      tenantId,
      result.error
    );
  }

  // Additional validation: deniedProviders and allowedProviders shouldn't overlap
  const policy = result.data;
  if (policy.allowedProviders && policy.deniedProviders) {
    const overlap = policy.allowedProviders.filter((p) =>
      policy.deniedProviders!.includes(p)
    );
    if (overlap.length > 0) {
      throw new PolicyValidationError(
        `Provider(s) appear in both allowed and denied lists: ${overlap.join(", ")}`,
        tenantId,
        "overlap_conflict"
      );
    }
  }

  // Validate preferredProvider is not in deniedProviders
  if (
    policy.preferredProvider &&
    policy.deniedProviders?.includes(policy.preferredProvider)
  ) {
    throw new PolicyValidationError(
      `Preferred provider "${policy.preferredProvider}" is in denied list`,
      tenantId,
      "preferred_denied_conflict"
    );
  }

  return policy;
}

// =============================================================================
// Policy Merging
// =============================================================================

/**
 * Platform default policy values.
 */
const PLATFORM_DEFAULTS: Partial<TenantRoutingPolicy> = {
  defaultStrategy: ROUTING_STRATEGY.cheapest,
  // No cost cap at platform level
  // All providers allowed by default
};

/**
 * Merge tenant policy with platform defaults.
 * Precedence: tenant deny > tenant allow > platform defaults
 *
 * @param tenantPolicy - Tenant-specific policy (or null)
 * @returns Effective policy
 */
export function mergeWithPlatformDefaults(
  tenantPolicy: TenantRoutingPolicy | null
): TenantRoutingPolicy {
  if (!tenantPolicy) {
    return {
      tenantId: "platform",
      ...PLATFORM_DEFAULTS,
    } as TenantRoutingPolicy;
  }

  return {
    ...PLATFORM_DEFAULTS,
    ...tenantPolicy,
    // deniedProviders is additive, not replaced
    deniedProviders: tenantPolicy.deniedProviders,
    // allowedProviders from tenant overrides platform
    allowedProviders: tenantPolicy.allowedProviders,
  };
}

/**
 * Extract hard constraints from a policy.
 */
export function extractHardConstraints(
  policy: TenantRoutingPolicy | null
): Partial<HardConstraints> {
  if (!policy) {
    return {};
  }

  return {
    vendorAllowlist: policy.allowedProviders,
    // Note: deniedProviders are handled separately during filtering
  };
}

/**
 * Extract soft constraints from a policy.
 */
export function extractSoftConstraints(
  policy: TenantRoutingPolicy | null
): Partial<SoftConstraints> {
  if (!policy) {
    return {};
  }

  return {
    preferredStrategy: policy.defaultStrategy,
    maxCostUsd: policy.maxCostPerRequestUsd,
    preferredProvider: policy.preferredProvider,
  };
}

/**
 * Determine the effective strategy given input and policy.
 * Precedence: explicit request > tenant policy > platform default
 */
export function resolveStrategy(
  input: RoutingInput,
  policy: TenantRoutingPolicy | null
): RoutingStrategy {
  // 1. Explicit request strategy takes precedence
  if (input.strategy) {
    return input.strategy;
  }

  // 2. Tenant policy default
  if (policy?.defaultStrategy) {
    return policy.defaultStrategy;
  }

  // 3. Platform default
  return ROUTING_STRATEGY.cheapest;
}

/**
 * Check if a provider is allowed by policy.
 */
export function isProviderAllowed(
  providerId: string,
  policy: TenantRoutingPolicy | null
): boolean {
  if (!policy) {
    return true;
  }

  // Denied takes precedence
  if (policy.deniedProviders?.includes(providerId)) {
    return false;
  }

  // If allowedProviders is specified, must be in list
  if (policy.allowedProviders && policy.allowedProviders.length > 0) {
    return policy.allowedProviders.includes(providerId);
  }

  return true;
}

/**
 * Get the effective cost cap from input and policy.
 */
export function getEffectiveCostCap(
  input: RoutingInput,
  policy: TenantRoutingPolicy | null
): number | undefined {
  // Request cost cap takes precedence
  if (input.constraints?.maxCostUsd !== undefined) {
    return input.constraints.maxCostUsd;
  }

  // Then tenant policy cap
  return policy?.maxCostPerRequestUsd;
}
