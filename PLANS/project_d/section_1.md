# D1 — Metrics Infrastructure

## D1.1 Prometheus setup

- [ ] **D1.1.1 Initialize Prometheus registry**
      Set up shared metrics registry for platform.

- [ ] **D1.1.2 Expose `/metrics` endpoint**
      Allow Prometheus to scrape metrics.

- [ ] **D1.1.3 Add metrics enable/disable flag**
      Allow metrics to be disabled in tests or local dev.

---

## D1.2 Metric definitions

- [ ] **D1.2.1 Define stable metric names and labels**
      Lock low-cardinality labels across the platform.

- [ ] **D1.2.2 Centralize metrics definitions**
      Keep metric creation in one shared module.

- [ ] **D1.2.3 Define counters**
      Track attempts, successes, failures, fallbacks.

- [ ] **D1.2.4 Define histograms**
      Track latency, TTFB, token counts, cost.

---

## D1.3 Metric emission

- [ ] **D1.3.1 Emit metrics from adapters**
      Track per-provider success, failure, latency, tokens.

- [ ] **D1.3.2 Emit metrics from executor**
      Track request-level metrics and fallback counts.

- [ ] **D1.3.3 Emit metrics from gateway**
      Track request volume, quota denials, auth failures.

---

## D1.4 Aggregation rules

- [ ] **D1.4.1 Define request-level metric aggregation**
      Aggregate metrics from successful attempts only.

- [ ] **D1.4.2 Define tenant-level aggregation**
      Cost per tenant, requests per tenant (low cardinality).

- [ ] **D1.4.3 Define Postgres vs Prometheus roles**
      Postgres stores state; Prometheus stores time-series metrics.
