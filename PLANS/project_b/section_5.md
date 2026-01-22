# B5 — Validation & Testing

## B5.1 Routing validation

- [ ] **B5.1.1 Validate alias-to-provider resolution**
      Confirm aliases resolve to expected providers and models.

- [ ] **B5.1.2 Validate fallback behavior**
      Force provider failures and confirm deterministic fallback.

- [ ] **B5.1.3 Validate provider availability gating**
      Ensure disabled providers are never selected.

- [ ] **B5.1.4 Validate routing determinism**
      Confirm routing snapshot is reused consistently per request.

---

## B5.2 Cost validation

- [ ] **B5.2.1 Validate pre-inference cost estimates**
      Compare estimates to actual costs across request types.

- [ ] **B5.2.2 Validate cost-aware routing**
      Confirm cheapest strategy selects lowest cost option.

---

## B5.3 Tenant policy validation

- [ ] **B5.3.1 Validate tenant policy loading**
      Confirm policies are fetched and applied correctly.

- [ ] **B5.3.2 Validate policy merge precedence**
      Confirm tenant overrides apply in correct order.

- [ ] **B5.3.3 Validate policy constraint enforcement**
      Confirm invalid policies are rejected.
