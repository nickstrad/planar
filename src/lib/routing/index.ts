/**
 * Routing Module (Project B)
 *
 * Model Router & Cost/Policy Engine
 *
 * Exports the public API for routing model requests.
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Routing input/output
  RoutingInput,
  RoutingConstraints,
  RoutingStrategy,
  RoutingResult,
  RoutingPlanSnapshot,
  RoutingError,

  // Candidates
  CandidateRef,
  FilteredCandidate,
  ModelCapabilities,

  // Configuration
  ModelCatalogEntry,
  ModelAliasMapping,
  CostRates,

  // Cost
  CostEstimate,
  ActualCost,

  // Policy
  TenantRoutingPolicy,
  HardConstraints,
  SoftConstraints,

  // Fallback
  FallbackConfig,
  FallbackRecord,

  // Errors
  AliasResolutionError,
  FallbackExhaustedError,
  PolicyConstraintError,
} from "./types";

// Type guards
export {
  isAliasResolutionError,
  isFallbackExhaustedError,
  isPolicyConstraintError,
  isRoutingError,
  DEFAULT_FALLBACK_CONFIG,
} from "./types";

// =============================================================================
// Configuration
// =============================================================================

export {
  initializeRoutingConfig,
  getModelCatalog,
  getModelEntry,
  getAliasMapping,
  getAllAliasMappings,
  isConfigInitialized,
  resetRoutingConfig,
  getCostRates,
  getTotalCostRate,
  ConfigValidationError,
  ModelCatalogSchema,
  AliasMappingsSchema,
} from "./config";

// =============================================================================
// Resolution
// =============================================================================

export {
  resolveAlias,
  resolveAliasOrThrow,
  expandCandidates,
  applyHardConstraints,
  buildHardConstraints,
  getViableCandidates,
  hasViableCandidates,
} from "./resolver";

// =============================================================================
// Selection
// =============================================================================

export {
  selectCheapest,
  selectQuality,
  selectPinned,
  selectPrimary,
  buildFallbackChain,
  determineStrategy,
  applyTenantPolicy,
  route,
} from "./selector";

// =============================================================================
// Cost
// =============================================================================

export {
  estimateCost,
  calculateActualCost,
  sortByCost,
  filterByCostCap,
  findCheapest,
  isWithinBudget,
} from "./cost";

// =============================================================================
// Policy
// =============================================================================

export {
  loadTenantPolicy,
  loadTenantPolicySync,
  setTenantPolicy,
  clearTenantPolicy,
  clearAllPolicies,
  validatePolicy,
  mergeWithPlatformDefaults,
  extractHardConstraints,
  extractSoftConstraints,
  resolveStrategy,
  isProviderAllowed,
  getEffectiveCostCap,
  PolicyValidationError,
  TenantRoutingPolicySchema,
} from "./policy";

// =============================================================================
// Persistence
// =============================================================================

export {
  // Snapshot & Cost (uses ExecutionRecord from Project A)
  persistRoutingSnapshot,
  loadRoutingSnapshot,
  persistActualCost,
  loadActualCost,
  isSnapshotPersistenceAvailable,

  // Tenant Policy (BLOCKED: needs Project C Tenant table)
  loadTenantPolicyFromDb,
  saveTenantPolicyToDb,
  isTenantPolicyPersistenceAvailable,
} from "./persistence";
