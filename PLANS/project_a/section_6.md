# A6 — Persistence (Execution State Only)

> Project A only persists execution-level state. Request lifecycle and tenant data are owned by Project C.

## A6.1 Execution state

- [ ] **A6.1.1 Define execution record schema**
      Attempt-level data: provider, model, timing, tokens, outcome.

- [ ] **A6.1.2 Persist attempt start**
      Record when provider call begins.

- [ ] **A6.1.3 Persist attempt completion**
      Record outcome, timing, token counts.

---

## A6.2 Write path rules

- [ ] **A6.2.1 Identify hot-path writes**
      Only persist lifecycle-critical updates synchronously.

- [ ] **A6.2.2 Make terminal writes reliable**
      Ensure terminal states always persist.

- [ ] **A6.2.3 Handle write failures gracefully**
      Don't fail execution if telemetry write fails.

---

## A6.3 Execution replay support

- [ ] **A6.3.1 Store execution input snapshot**
      Capture what was sent to provider for debugging.

- [ ] **A6.3.2 Store execution output**
      Capture final response for replay/debugging.
