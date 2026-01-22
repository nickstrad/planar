# D4 — Validation & Testing

## D4.1 Metrics validation

- [ ] **D4.1.1 Validate metrics endpoint**
      Confirm `/metrics` endpoint is scrapeable.

- [ ] **D4.1.2 Validate counters increment**
      Confirm counters increase on events.

- [ ] **D4.1.3 Validate histograms observe**
      Confirm histograms record values correctly.

- [ ] **D4.1.4 Validate label cardinality**
      Ensure no high-cardinality labels leak into metrics.

---

## D4.2 Tracing validation

- [ ] **D4.2.1 Validate trace context propagation**
      Confirm request ID flows through all components.

- [ ] **D4.2.2 Validate span timing**
      Confirm latency breakdown is accurate.

- [ ] **D4.2.3 Validate fallback logging**
      Confirm fallback chain is fully logged.

---

## D4.3 Error validation

- [ ] **D4.3.1 Validate error classification**
      Confirm errors map to correct kinds.

- [ ] **D4.3.2 Validate error metrics**
      Confirm error counters increment correctly.

- [ ] **D4.3.3 Validate log sanitization**
      Confirm no sensitive data in logs.
