# Project D — Observability & Telemetry Layer

> **Purpose**: Makes inference measurable, debuggable, and auditable through structured metrics, traces, and logs.

---

## Scope

### Owns
- End-to-end request tracing
- Metrics aggregation and exposure
- Structured logging
- Error taxonomy and classification
- Prometheus endpoint and configuration

### Does NOT Own
- Model execution (Project A)
- Business billing logic (Project F)
- Request lifecycle (Project C)

---

## Interfaces

### Consumes
- Execution telemetry from Runtime (Project A)
- Routing telemetry from Router (Project B)
- Request lifecycle events from Gateway (Project C)

### Emits
- Prometheus metrics endpoint
- Structured logs
- Trace data (future: OpenTelemetry)

---

## Design Principles

1. **Low cardinality** — Labels must not explode metric count
2. **Structured** — All telemetry follows consistent schemas
3. **Observable** — Every decision point emits signals
4. **Queryable** — Metrics support operational questions
5. **Non-blocking** — Telemetry never blocks request path

---

## Section Map

| Section | Purpose |
|---------|---------|
| D1 | Metrics Infrastructure |
| D2 | Request Tracing |
| D3 | Error Taxonomy |
| D4 | Validation & Testing |

---

## Cross-Project Coordination

### Project B (Router) Dependencies

> **When implementing telemetry infrastructure, support these events from Project B:**

**Routing Decision Event:**
```typescript
interface RoutingDecisionEvent {
  type: 'routing_decision';
  snapshotId: string;
  tenantId: string;
  modelAlias: string;
  strategy: 'cheapest' | 'quality' | 'pinned';
  primaryProvider: string;
  primaryModel: string;
  fallbackCount: number;
  estimatedCostUsd: number;
  candidateCount: number;
  timestamp: number;
}
```

**Fallback Triggered Event:**
```typescript
interface FallbackTriggeredEvent {
  type: 'fallback_triggered';
  snapshotId: string;
  attemptNumber: number;
  fromProvider: string;
  toProvider: string;
  errorKind: string;
  timestamp: number;
}
```

**After implementing telemetry:**
1. Export `TelemetryEmitter` interface that Project B can use
2. Notify Project B to update routing to emit events:
   - Emit `routing_decision` after `route()` completes
   - Emit `fallback_triggered` during fallback execution
3. Project B will implement in `src/lib/routing/selector.ts`

**Metrics to expose:**
- `routing_decisions_total` — counter by strategy, alias
- `routing_fallbacks_total` — counter by error_kind
- `routing_cost_estimate_usd` — histogram
- `routing_candidates_filtered_total` — counter by filter_reason

See: `PLANS/project_b/section_5.md` (B5.6.2) for test requirements.
