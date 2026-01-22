# A4 — Provider Adapters

## A4.1 Provider adapter contract

- [ ] **A4.1.1 Define adapter interface**
      Require `generate`, `healthCheck`, and `capabilities`.

- [ ] **A4.1.2 Normalize token events**
      Emit uniform token events across providers.

- [ ] **A4.1.3 Normalize provider errors**
      Map provider errors to platform error kinds.

- [ ] **A4.1.4 Define capabilities interface**
      Streaming support, max context, supported features.

---

## A4.2 OpenAI adapter

- [ ] **A4.2.1 Implement OpenAI adapter**
      Normalize OpenAI streaming and non-streaming responses.

- [ ] **A4.2.2 Handle OpenAI-specific errors**
      Map rate limits, auth errors, model errors to platform kinds.

- [ ] **A4.2.3 Implement streaming normalization**
      Convert OpenAI SSE chunks to platform token events.

- [ ] **A4.2.4 Implement non-streaming support**
      Handle non-streaming responses when requested.

---

## A4.3 Ollama adapter

- [ ] **A4.3.1 Implement Ollama adapter**
      Normalize local streaming output.

- [ ] **A4.3.2 Handle Ollama-specific errors**
      Map connection errors, model not found to platform kinds.

- [ ] **A4.3.3 Implement streaming normalization**
      Convert Ollama response chunks to platform token events.

---

## A4.4 Pluggable provider architecture

- [ ] **A4.4.1 Enforce provider adapter contract**
      Ensure all providers conform to the same interface.

- [ ] **A4.4.2 Centralize provider registration**
      Add new providers via a single registry without refactors.

- [ ] **A4.4.3 Expose provider capabilities**
      Allow router to query provider features dynamically.

- [ ] **A4.4.4 Support bounded provider-specific options**
      Allow limited provider-specific tuning via validated JSON.

---

## A4.5 Telemetry emission

- [ ] **A4.5.1 Emit execution telemetry**
      Send timing, token counts, success/failure to observability.

- [ ] **A4.5.2 Define telemetry event types**
      Standardize what adapters emit for Project D consumption.
