# Project C2 — Inference Playground (UI)

> **Purpose**: Provides a human-facing interface for testing, debugging, and demonstrating inference behavior.

---

## Scope

### Owns
- Prompt authoring and submission UI
- Streaming visualization
- Routing decision visibility
- Latency and cost breakdown display
- Developer console shell

### Does NOT Own
- Production workflow execution
- Long-term state storage
- API implementation (Project C)
- Inference execution (Project A)

---

## Interfaces

### Consumes
- Inference API from Gateway (Project C)
- Routing metadata from responses
- Telemetry data from Observability (Project D)

### Emits
- User interactions (for analytics)

---

## Design Principles

1. **Developer-first** — Optimized for testing and debugging
2. **Real-time** — Show streaming tokens as they arrive
3. **Transparent** — Expose routing decisions and costs
4. **Lightweight** — No persistent state beyond session

---

## Section Map

| Section | Purpose |
|---------|---------|
| C2.1 | Playground UI Components |
| C2.2 | Streaming Visualization |
| C2.3 | Developer Tools |
