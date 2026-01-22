# C1 — API Surface & Request Handling

## C1.1 Inference API endpoint

- [ ] **C1.1.1 Create `inference.run` tRPC mutation**
      Add a protected mutation that starts inference and returns `requestId` and `streamUrl`.

- [ ] **C1.1.2 Create Zod schema for inference input**
      Validate model alias, messages, stream flag, and options at the API boundary.

- [ ] **C1.1.3 Normalize and sanitize messages**
      Enforce valid roles, trim content, and reject empty or malformed inputs.

- [ ] **C1.1.4 Enforce MVP safety limits**
      Apply max message count, max input size, and default timeout limits.

- [ ] **C1.1.5 Return stream metadata**
      Return identifiers needed for SSE streaming.

---

## C1.2 SSE streaming endpoint

- [ ] **C1.2.1 Create SSE route `/api/inference/stream/[requestId]`**
      Implement App Router route that returns an SSE stream.

- [ ] **C1.2.2 Authenticate via Better Auth session**
      Require valid session on stream requests.

- [ ] **C1.2.3 Enforce tenant ownership**
      Verify request belongs to the authenticated tenant.

- [ ] **C1.2.4 Connect to stream registry**
      Bind SSE response to runtime stream channel.

---

## C1.3 Request cancellation

- [ ] **C1.3.1 Create cancel endpoint**
      Allow clients to cancel in-progress requests.

- [ ] **C1.3.2 Validate cancellation permission**
      Only allow tenant that owns request to cancel.

- [ ] **C1.3.3 Propagate cancellation to runtime**
      Signal Project A executor to abort.

---

## C1.4 API versioning

- [ ] **C1.4.1 Define versioning strategy**
      URL-based (`/v1/`) or header-based versioning.

- [ ] **C1.4.2 Document API contract**
      OpenAPI spec or equivalent for `/v1/infer`.
