# Project A — Core Inference Runtime

> **Purpose**: Provides a standardized, model-agnostic runtime for executing inference requests across remote APIs, local models, and hosted model nodes.

This file should be:
- Read **before starting any new section**
- Updated only when architecture decisions change
- Used as the shared mental model for Project A implementation

---

## 1. What Project A Is

Project A is the **core inference runtime** — the execution engine that actually runs inference requests against model backends.

It is responsible for:
- Executing inference requests given a resolved routing plan
- Normalizing streaming output across providers (SSE)
- Handling timeouts, retries, and cancellation
- Emitting execution telemetry

It is **not** responsible for:
- Model selection or routing (Project B)
- Tenant authentication or request lifecycle (Project C)
- Quotas, billing, or rate limiting (Project C + F)
- Metrics aggregation (Project D)

---

## 2. Scope Boundaries

### Owns
- Unified inference contract: `infer(request) → response`
- Backend adapters (OpenAI, Anthropic, Gemini, Ollama, llama.cpp, MLX)
- Streaming normalization (SSE protocol and utilities)
- Execution controls (timeouts, retries, cancellation)
- Error normalization and classification
- Token event emission
- Execution-level persistence (attempt records)

### Does NOT Own
- Model selection or routing → **Project B**
- Tenant management or authentication → **Project C**
- Request lifecycle (create, track, cancel) → **Project C**
- Pricing, quotas, or billing → **Project C + F**
- Observability aggregation → **Project D** (emits signals only)

---

## 3. Core Design Principles

### 3.1 Model-agnostic execution
- Same contract regardless of backend
- Providers are swappable without executor changes

### 3.2 Streaming-first architecture
- SSE is the primary transport
- Non-streaming is a supported subset, not the default

### 3.3 Deterministic execution
- Same input produces same behavior
- Execution is replayable given same routing plan

### 3.4 Minimal policy
- No business logic in runtime
- Maximum correctness, minimum opinion

### 3.5 Portable
- Works across local, remote, and hosted environments
- No assumptions about deployment context

---

## 4. High-Level Architecture

```
Gateway (Project C)
        ↓
        │ Routing Plan from Router (Project B)
        ↓
┌───────────────────────────────────────┐
│         Project A: Runtime            │
│                                       │
│  ┌─────────────┐                      │
│  │  Executor   │ ← Entry point        │
│  └──────┬──────┘                      │
│         │                             │
│         ▼                             │
│  ┌─────────────┐    ┌──────────────┐  │
│  │  Adapters   │───→│ SSE Engine   │  │
│  │ OpenAI      │    │              │  │
│  │ Ollama      │    │ Stream       │  │
│  │ ...         │    │ Registry     │  │
│  └─────────────┘    └──────────────┘  │
│         │                   │         │
│         ▼                   ▼         │
│  ┌─────────────┐    ┌──────────────┐  │
│  │ Telemetry   │    │ Token Stream │  │
│  │ (to Proj D) │    │ (to client)  │  │
│  └─────────────┘    └──────────────┘  │
└───────────────────────────────────────┘
```

---

## 5. Technology Stack

- **Streaming**: Server-Sent Events (SSE)
- **Providers (initial)**: OpenAI, Ollama
- **Providers (future)**: Anthropic, Gemini, llama.cpp, MLX
- **Database**: PostgreSQL (Prisma) — execution records only
- **Shared infrastructure**: Next.js, tRPC (defined in A1)

---

## 6. Section Map

| Section | Purpose |
|---------|---------|
| **A1** | Project Setup & Baseline (shared infrastructure) |
| **A2** | Inference Contracts & Types |
| **A3** | SSE Streaming Engine |
| **A4** | Provider Adapters |
| **A5** | Inference Executor |
| **A6** | Persistence (execution state only) |
| **A7** | Configuration & Extensibility |
| **A8** | Validation & Testing |

---

## 7. Interfaces with Other Projects

### Consumes from Project B (Router)
- Resolved routing plan (provider + model + parameters)
- Fallback chain (if primary fails)

### Consumes from Project C (Gateway)
- Execution requests with tenant context
- Cancellation signals

### Emits to Project D (Observability)
- Execution telemetry (timing, tokens, success/failure)
- Error events with classification

### Emits to Project C (Gateway)
- Token streams via SSE
- Terminal completion events
- Execution metadata

---

## 8. How to Use This File

Before starting work on **any section**:

1. Read this document
2. Read the specific section you're working on
3. Identify what this section owns vs. what belongs to other projects
4. Implement only what belongs to Project A

If you feel tempted to:
- Add auth or tenant logic → that's **Project C**
- Add routing logic → that's **Project B**
- Add quota enforcement → that's **Project C**
- Add metrics aggregation → that's **Project D**

---

## 9. Cross-Project Coordination

### Project B (Router) Dependencies

> **When implementing the `InferenceRequest` table, include these fields for Project B:**

```prisma
model InferenceRequest {
  // ... Project A fields ...

  /// Project B: Routing decision snapshot (JSON blob)
  /// Stores RoutingPlanSnapshot for replay/debugging
  routingSnapshot    Json?

  /// Project B: Actual cost after execution (JSON blob)
  /// Stores ActualCost for billing
  actualCost         Json?
}
```

**After adding these fields:**
1. Run migration: `npx prisma migrate dev`
2. Notify Project B to update `src/lib/routing/persistence.ts`:
   - Uncomment Prisma code in `persistRoutingSnapshot()`
   - Uncomment Prisma code in `loadRoutingSnapshot()`
   - Uncomment Prisma code in `persistActualCost()`
3. Update `isPersistenceAvailable()` to return `true`

See: `PLANS/project_b/section_6.md` for full schema details.

---

## 10. What "Done" Looks Like for Project A

- Executor can execute any routing plan
- All adapters conform to the same interface
- Streaming works reliably with correct SSE semantics
- Errors are normalized across providers
- Telemetry is emitted for all executions
- Cancellation works end-to-end
