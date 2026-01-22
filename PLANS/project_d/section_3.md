# D3 — Error Taxonomy

## D3.1 Error classification

- [ ] **D3.1.1 Define platform error kinds**
      Auth, validation, quota, routing, provider, internal.

- [ ] **D3.1.2 Map provider errors to platform kinds**
      Normalize OpenAI, Ollama errors to taxonomy.

- [ ] **D3.1.3 Define retryable vs terminal errors**
      Classify which errors can trigger fallback.

---

## D3.2 Error metrics

- [ ] **D3.2.1 Track errors by kind**
      Counter per error classification.

- [ ] **D3.2.2 Track errors by provider**
      Counter per provider error type.

- [ ] **D3.2.3 Track error rates**
      Percentage of requests failing by type.

---

## D3.3 Error logging

- [ ] **D3.3.1 Log errors with full context**
      Include request ID, tenant, provider, error details.

- [ ] **D3.3.2 Sanitize sensitive data**
      Never log API keys, tokens, or PII.

- [ ] **D3.3.3 Include stack traces for internal errors**
      Capture debugging info for platform bugs.
