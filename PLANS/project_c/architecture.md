# Project C — Inference Gateway (API & Tenant Layer)

> **Purpose**: Acts as the public entry point into the inference platform. Handles authentication, tenant isolation, request lifecycle, and rate limiting.

---

## Scope

### Owns
- Public API surface (`/v1/infer`, SSE endpoints)
- API key and session-based authentication
- Tenant identity and isolation
- Request lifecycle ownership (create, track, cancel)
- Per-tenant usage tracking
- Quotas and rate limits
- Request validation and sanitization

### Does NOT Own
- Model routing decisions (Project B)
- Inference execution (Project A)
- Advanced prompt logic (Project E)
- Metrics aggregation (Project D)

---

## Interfaces

### Consumes
- Routing decisions from Router (Project B)
- Execution results from Runtime (Project A)
- Usage data for quota enforcement

### Emits
- Inference requests to Router (Project B)
- Stream connections to clients
- Request lifecycle events to Observability (Project D)

---

## Design Principles

1. **Tenant-first** — Every request is tenant-scoped from entry
2. **Secure by default** — Auth required on all endpoints
3. **Lifecycle ownership** — Gateway owns request state machine
4. **Rate limit early** — Reject over-quota requests before routing
5. **Clean API** — Versioned, documented, predictable

---

## Section Map

| Section | Purpose |
|---------|---------|
| C1 | API Surface & Request Handling |
| C2 | Authentication & Tenant Resolution |
| C3 | Request Lifecycle Management |
| C4 | Quotas & Rate Limiting |
| C5 | Validation & Testing |

---

## Cross-Project Coordination

### Project B (Router) Dependencies

> **When implementing the `Tenant` table, include this field for Project B:**

```prisma
model Tenant {
  // ... Project C fields ...

  /// Project B: Tenant-specific routing policy (JSON blob)
  /// Stores TenantRoutingPolicy for tenant-level routing constraints
  /// Contains: allowedProviders, deniedProviders, preferredProvider,
  ///           maxCostPerRequestUsd, defaultStrategy
  routingPolicy      Json?
}
```

**After adding this field:**
1. Run migration: `npx prisma migrate dev`
2. Notify Project B to update `src/lib/routing/persistence.ts`:
   - Uncomment Prisma code in `loadTenantPolicyFromDb()`
   - Uncomment Prisma code in `saveTenantPolicyToDb()`
3. Update `isPersistenceAvailable()` to return `true`

**Policy Schema (for validation):**
```typescript
interface TenantRoutingPolicy {
  tenantId: string;
  allowedProviders?: string[];   // Empty = allow all
  deniedProviders?: string[];    // Overrides allowed
  preferredProvider?: string;    // Soft preference
  maxCostPerRequestUsd?: number;
  defaultStrategy?: 'cheapest' | 'quality' | 'pinned';
}
```

See: `PLANS/project_b/section_6.md` for full schema details.
