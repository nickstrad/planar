# C4 — Quotas & Rate Limiting

## C4.1 Quota policy

- [ ] **C4.1.1 Define quota dimensions**
      Support cost, tokens, and concurrency limits.

- [ ] **C4.1.2 Define what counts toward usage**
      Decide how failed attempts affect quotas.

- [ ] **C4.1.3 Define quota period boundaries**
      Monthly reset, rolling window, or custom periods.

---

## C4.2 QuotaService implementation

- [ ] **C4.2.1 Define QuotaService interface**
      Standardize `canStartInference()`, `recordUsage()`, `getUsage()`.

- [ ] **C4.2.2 Implement Prisma-backed checks**
      Enforce limits using Postgres data.

- [ ] **C4.2.3 Run quota preflight check**
      Call `QuotaService.canStartInference()` before execution.

---

## C4.3 Concurrency enforcement

- [ ] **C4.3.1 Count active requests**
      Track running requests per tenant.

- [ ] **C4.3.2 Enforce max concurrent requests**
      Reject new requests when at concurrency limit.

- [ ] **C4.3.3 Release concurrency on terminal states**
      Ensure concurrency is freed on completion/failure/cancel.

---

## C4.4 Monthly usage enforcement

- [ ] **C4.4.1 Aggregate monthly usage**
      Compute tokens and cost per tenant per month.

- [ ] **C4.4.2 Deny requests over quota**
      Cancel requests cleanly when limits exceeded.

- [ ] **C4.4.3 Emit quota events**
      Notify when approaching or exceeding limits.

---

## C4.5 Rate limiting

- [ ] **C4.5.1 Define rate limit tiers**
      Requests per minute/hour by tenant plan.

- [ ] **C4.5.2 Implement rate limiter**
      Token bucket or sliding window algorithm.

- [ ] **C4.5.3 Return rate limit headers**
      Include `X-RateLimit-*` headers in responses.
