# D2 — Request Tracing

## D2.1 Trace structure

- [ ] **D2.1.1 Define trace context type**
      Request ID, tenant ID, timestamps, spans.

- [ ] **D2.1.2 Propagate trace context through request**
      Ensure all components can log with request context.

- [ ] **D2.1.3 Define span types**
      Gateway, routing, execution, provider call spans.

---

## D2.2 Per-request trace data

- [ ] **D2.2.1 Capture prompt size**
      Log input token count or character count.

- [ ] **D2.2.2 Capture selected model**
      Log resolved provider and model from routing.

- [ ] **D2.2.3 Capture tokens in/out**
      Log input and output token counts.

- [ ] **D2.2.4 Capture latency breakdown**
      TTFB, total latency, per-span timing.

---

## D2.3 Retry and fallback visibility

- [ ] **D2.3.1 Log fallback attempts**
      Record each provider attempt with outcome.

- [ ] **D2.3.2 Log retry decisions**
      Record why retries occurred or didn't.

- [ ] **D2.3.3 Correlate fallbacks to final outcome**
      Link attempt chain to terminal result.

---

## D2.4 Structured logging

- [ ] **D2.4.1 Define log schema**
      Consistent JSON structure for all logs.

- [ ] **D2.4.2 Implement structured logger**
      Logger that outputs schema-compliant JSON.

- [ ] **D2.4.3 Add log levels**
      Debug, info, warn, error with appropriate usage.
