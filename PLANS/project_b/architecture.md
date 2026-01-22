# Project B — Model Router & Cost/Policy Engine

> **Purpose**: Select the optimal model backend for each inference request based on cost, latency, capability, and policy constraints.

---

## Scope

### Owns
- Cross-provider model selection
- Alias → provider/model resolution
- Routing strategies (cheapest, fastest, quality, pinned)
- Fallback chains and ordering
- Hard constraints (context length, streaming, region/vendor allowlists)
- Pre- and post-inference cost accounting
- Tenant routing policy overlays
- Routing decision snapshots

### Does NOT Own
- Executing inference (Project A)
- Managing model lifecycle
- Hosting models
- Tenant authentication (Project C)
- Metrics aggregation (Project D)

---

## Interfaces

### Consumes
- Inference requests from Gateway (Project C)
- Provider capabilities from Runtime (Project A)
- Tenant routing policies from Gateway (Project C)

### Emits
- Routing decisions (provider + model + fallback chain)
- Cost estimates (pre-inference)
- Routing telemetry to Observability (Project D)

---

## Design Principles

1. **Deterministic routing** — Same input always produces same routing plan
2. **Snapshot decisions** — Routing plans are captured and replayable
3. **Policy-driven** — Constraints are explicit, not hardcoded
4. **Cost-aware** — Every decision considers cost implications
5. **Tenant-safe** — Tenant policies cannot bypass platform constraints

---

## Section Map

| Section | Purpose |
|---------|---------|
| B1 | Routing Primitives & Configuration |
| B2 | Alias Resolution & Candidate Selection |
| B3 | Fallback Logic & Decision Recording |
| B4 | Cost Estimation & Policy Engine |
| B5 | Validation & Testing |
