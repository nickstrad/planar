# A3 — SSE Streaming Engine

## A3.1 Define SSE protocol

- [ ] **A3.1.1 Define supported SSE event types**
      Lock `token`, `metadata`, `error`, and `done`.

- [ ] **A3.1.2 Define payload schemas**
      Specify JSON shapes for each event type.

- [ ] **A3.1.3 Define terminal ordering guarantees**
      Ensure terminal events are emitted exactly once.

---

## A3.2 Implement SSE utilities

- [ ] **A3.2.1 Create SSE response helper**
      Build reusable stream helper for Next.js App Router.

- [ ] **A3.2.2 Set correct SSE headers**
      Disable caching and enable keep-alive.

- [ ] **A3.2.3 Implement event serialization**
      Format `event:` and `data:` lines correctly.

- [ ] **A3.2.4 Add heartbeat support**
      Periodically emit comments to keep connection alive.

- [ ] **A3.2.5 Handle abort signals**
      Detect client disconnects and trigger cleanup.

---

## A3.3 In-memory stream registry

- [ ] **A3.3.1 Define stream registry interface**
      Support create, publish, subscribe, and close operations.

- [ ] **A3.3.2 Map requestId to stream**
      Track active streams by requestId.

- [ ] **A3.3.3 Enforce single-writer semantics**
      Only executor can publish events for a request.

- [ ] **A3.3.4 Add TTL cleanup**
      Expire abandoned streams automatically.

---

## A3.4 Executor → stream publishing

- [ ] **A3.4.1 Publish token events**
      Forward provider tokens into SSE stream.

- [ ] **A3.4.2 Emit first-token metadata**
      Publish TTFB-related metadata.

- [ ] **A3.4.3 Emit terminal metadata**
      Send final metrics before completion.

- [ ] **A3.4.4 Close stream deterministically**
      Ensure cleanup after terminal event.

---

## A3.5 Error handling

- [ ] **A3.5.1 Normalize errors to SSE events**
      Emit consistent `error` events.

- [ ] **A3.5.2 Guarantee error → done ordering**
      Always follow error with done.

- [ ] **A3.5.3 Handle provider failures**
      Close stream cleanly on upstream failure.
