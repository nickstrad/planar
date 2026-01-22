# A2 — Inference Contracts & Types

## A2.1 Define inference request contract

- [ ] **A2.1.1 Define inference request TypeScript types**
      Create shared types for messages, options, and model identifiers used by executor and providers.

- [ ] **A2.1.2 Define internal stream event types**
      Standardize `token`, `metadata`, `error`, and `done` events emitted during inference.

- [ ] **A2.1.3 Define execution input contract**
      Type for what executor receives: resolved provider, model, messages, options.

- [ ] **A2.1.4 Define execution output contract**
      Type for what executor returns: tokens, metadata, final response.

---

## A2.2 Error contracts

- [ ] **A2.2.1 Define platform error kinds**
      Provider error, timeout, cancellation, internal error.

- [ ] **A2.2.2 Define error response type**
      Standardize error shape returned from execution.

- [ ] **A2.2.3 Define retryable error classification**
      Which errors can trigger retry within executor.

---

## A2.3 Execution semantics

- [ ] **A2.3.1 Define timeout contract**
      How timeouts are specified and enforced.

- [ ] **A2.3.2 Define cancellation contract**
      How cancellation signals propagate to providers.

- [ ] **A2.3.3 Define retry contract**
      How retries work within a single execution (not fallback).
