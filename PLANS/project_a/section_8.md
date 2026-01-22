# A8 — Validation & Testing

## A8.1 Streaming validation

- [ ] **A8.1.1 Validate OpenAI streaming**
      Confirm tokens stream incrementally with correct SSE formatting.

- [ ] **A8.1.2 Validate Ollama streaming**
      Confirm local inference streams correctly.

- [ ] **A8.1.3 Validate terminal event semantics**
      Ensure exactly one terminal completion path.

- [ ] **A8.1.4 Validate client disconnect handling**
      Disconnect mid-stream and confirm proper cancellation.

---

## A8.2 Adapter validation

- [ ] **A8.2.1 Validate adapter contract compliance**
      Confirm all adapters implement required interface.

- [ ] **A8.2.2 Validate error normalization**
      Confirm provider errors map to platform kinds.

- [ ] **A8.2.3 Validate capabilities reporting**
      Confirm adapters report accurate capabilities.

---

## A8.3 Executor validation

- [ ] **A8.3.1 Validate execution lifecycle**
      Confirm start → execute → complete flow.

- [ ] **A8.3.2 Validate retry behavior**
      Confirm retries occur on retryable errors.

- [ ] **A8.3.3 Validate cancellation handling**
      Confirm cancellation propagates correctly.

---

## A8.4 Persistence validation

- [ ] **A8.4.1 Validate attempt recording**
      Confirm attempts are persisted with correct data.

- [ ] **A8.4.2 Validate terminal state persistence**
      Confirm final outcome is always recorded.

---

## A8.5 End-to-end validation

- [ ] **A8.5.1 End-to-end inference works**
      Requests execute, stream, and complete correctly.

- [ ] **A8.5.2 Error handling is robust**
      Provider failures are handled gracefully.

- [ ] **A8.5.3 Telemetry is emitted**
      Execution events flow to observability.
