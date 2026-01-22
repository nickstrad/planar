# C3 — Request Lifecycle Management

## C3.1 Request creation

- [ ] **C3.1.1 Persist initial request row**
      Insert `InferenceRequest` with `queued` status and request payload snapshot.

- [ ] **C3.1.2 Generate unique request ID**
      Create collision-resistant identifier for request tracking.

- [ ] **C3.1.3 Capture request metadata**
      Store tenant, user, timestamp, and input summary.

---

## C3.2 Lifecycle transitions

- [ ] **C3.2.1 Define request state machine**
      States: queued → running → completed/failed/canceled.

- [ ] **C3.2.2 Track lifecycle timestamps**
      Record queuedAt, startedAt, completedAt for each request.

- [ ] **C3.2.3 Handle state transition events**
      Update database and emit events on transitions.

---

## C3.3 Request completion

- [ ] **C3.3.1 Persist final request outcome**
      Save resolved provider, metrics, and terminal status.

- [ ] **C3.3.2 Record usage for billing**
      Capture tokens, cost, and duration for quota tracking.

- [ ] **C3.3.3 Clean up request resources**
      Release concurrency slots and stream registrations.

---

## C3.4 Cancellation handling

- [ ] **C3.4.1 Mark request as canceled**
      Update status with cancellation reason.

- [ ] **C3.4.2 Record partial usage**
      Capture tokens consumed before cancellation.

- [ ] **C3.4.3 Emit cancellation event**
      Notify observability of canceled request.
