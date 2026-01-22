# B3 — Fallback Logic & Decision Recording

## B3.1 Fallback chain construction

- [ ] **B3.1.1 Build fallback chain from candidates**
      Order remaining candidates after primary selection.

- [ ] **B3.1.2 Define retryable error classification**
      Specify which errors trigger fallback vs terminal failure.

- [ ] **B3.1.3 Execute fallback on retryable errors**
      Move to next candidate when allowed by error type.

---

## B3.2 Decision recording

- [ ] **B3.2.1 Persist routing snapshot**
      Save routing plan JSON for deterministic replay.

- [ ] **B3.2.2 Record fallback decisions**
      Persist each fallback attempt with reason and outcome.

- [ ] **B3.2.3 Emit routing telemetry**
      Send routing decisions to Observability (Project D).

---

## B3.3 Tenant-aware routing hooks

- [ ] **B3.3.1 Accept tenantId in router input**
      Ensure per-tenant logic is possible.

- [ ] **B3.3.2 Load tenant routing policies**
      Fetch tenant routing overrides from Prisma when present.

- [ ] **B3.3.3 Define tenant policy JSON schema**
      Standardize allow/deny/prefer and constraint overrides.

- [ ] **B3.3.4 Merge base config with tenant overrides**
      Apply clear precedence rules when combining configs.

- [ ] **B3.3.5 Validate tenant policies**
      Reject invalid or unsafe tenant policy definitions.
