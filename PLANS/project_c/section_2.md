# C2 — Authentication & Tenant Resolution

## C2.1 Session authentication

- [ ] **C2.1.1 Resolve Better Auth session**
      Extract `userId` and `tenantId` from session and attach to tRPC context.

- [ ] **C2.1.2 Resolve tenant via Prisma**
      Use `UserTenantSettings` or `TenantMembership` to determine active tenant.

- [ ] **C2.1.3 Reject unauthenticated requests**
      Return 401 for missing or invalid sessions.

---

## C2.2 API key authentication

- [ ] **C2.2.1 Define API key schema**
      Structure for API keys with tenant binding.

- [ ] **C2.2.2 Validate API key on request**
      Check key validity and extract tenant context.

- [ ] **C2.2.3 Rate limit by API key**
      Apply per-key rate limits separate from tenant limits.

---

## C2.3 Tenant context

- [ ] **C2.3.1 Create tenant context type**
      Standardize tenant info passed through request lifecycle.

- [ ] **C2.3.2 Attach tenant context to all operations**
      Ensure every downstream call includes tenant scope.

- [ ] **C2.3.3 Enforce tenant isolation in queries**
      Prevent cross-tenant data access at query level.
