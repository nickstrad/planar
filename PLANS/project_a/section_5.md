# A5 — Inference Executor

## A5.1 Executor boundaries

- [ ] **A5.1.1 Define executor input/output contracts**
      Standardize executor API: receives routing plan, emits results.

- [ ] **A5.1.2 Define executor lifecycle**
      Start, execute, complete/fail/cancel states.

---

## A5.2 Execution orchestration

- [ ] **A5.2.1 Transition request to running**
      Update lifecycle fields when executor begins.

- [ ] **A5.2.2 Execute provider call**
      Invoke adapter with resolved provider and model.

- [ ] **A5.2.3 Stream tokens via SSE**
      Forward tokens in real time to stream registry.

---

## A5.3 Provider attempt handling

- [ ] **A5.3.1 Create provider attempt record**
      Track each execution attempt with timing and outcome.

- [ ] **A5.3.2 Handle success**
      Complete attempt, aggregate metrics, emit terminal event.

- [ ] **A5.3.3 Handle failure**
      Record failure reason, emit error, determine if retryable.

- [ ] **A5.3.4 Execute retry on retryable errors**
      Retry within same provider if error is retryable.

---

## A5.4 Terminal handling

- [ ] **A5.4.1 Persist final execution outcome**
      Save resolved provider, metrics, and status.

- [ ] **A5.4.2 Emit terminal SSE events**
      Ensure single terminal sequence (metadata → done).

- [ ] **A5.4.3 Clean up resources**
      Close streams, release any held resources.

---

## A5.5 Cancellation handling

- [ ] **A5.5.1 Listen for cancellation signal**
      Accept abort signal from Gateway.

- [ ] **A5.5.2 Propagate cancellation to provider**
      Abort in-flight provider request.

- [ ] **A5.5.3 Emit cancellation event**
      Send error event with cancellation reason.
