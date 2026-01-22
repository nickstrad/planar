# C5 — Validation & Testing

## C5.1 Authentication validation

- [ ] **C5.1.1 Validate session authentication**
      Confirm valid sessions grant access.

- [ ] **C5.1.2 Validate session rejection**
      Confirm invalid/missing sessions return 401.

- [ ] **C5.1.3 Validate API key authentication**
      Confirm valid API keys grant access.

---

## C5.2 Tenant isolation validation

- [ ] **C5.2.1 Validate tenant scoping on requests**
      Ensure requests are tenant-isolated.

- [ ] **C5.2.2 Validate cross-tenant access prevention**
      Confirm tenant A cannot access tenant B's requests.

- [ ] **C5.2.3 Validate tenant context propagation**
      Confirm tenant context flows to all downstream services.

---

## C5.3 Quota validation

- [ ] **C5.3.1 Validate concurrency limits**
      Ensure concurrent request caps are enforced.

- [ ] **C5.3.2 Validate monthly cost and token limits**
      Ensure usage caps deny new requests correctly.

- [ ] **C5.3.3 Validate quota denial persistence**
      Confirm denied requests are marked canceled with correct reason.

---

## C5.4 Lifecycle validation

- [ ] **C5.4.1 Validate request state transitions**
      Confirm correct state machine behavior.

- [ ] **C5.4.2 Validate cancellation handling**
      Confirm cancel propagates and records correctly.

- [ ] **C5.4.3 Validate usage recording**
      Confirm tokens and cost are captured accurately.
