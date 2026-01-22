# A8 — Validation & Testing

> **Purpose**: Define test patterns and validation strategies for all Project A components to ensure correctness, reliability, and proper integration.

**Depends on**: All previous sections (A2-A7)

**File location**: `src/lib/inference/__tests__/`

---

## A8.1 Streaming Validation

### A8.1.1 Test SSE serialization

```typescript
// src/lib/inference/__tests__/sse/serialize.test.ts
import { describe, it, expect } from "@jest/globals";
import { serializeSSE, serializeHeartbeat } from "../../sse/serialize";
import type { TokenEvent, DoneEvent } from "../../types";

describe("SSE serialization", () => {
  it("serializes token event correctly", () => {
    const event: TokenEvent = {
      type: "token",
      timestamp: 1234567890,
      data: { token: "Hello", index: 0 },
    };

    const serialized = serializeSSE(event);

    expect(serialized).toBe(
      'event: token\ndata: {"type":"token","timestamp":1234567890,"data":{"token":"Hello","index":0}}\n\n'
    );
  });

  it("serializes done event correctly", () => {
    const event: DoneEvent = {
      type: "done",
      timestamp: 1234567890,
      data: { result: null },
    };

    const serialized = serializeSSE(event);

    expect(serialized).toContain("event: done");
    expect(serialized).toContain('"type":"done"');
  });

  it("serializes heartbeat as comment", () => {
    const heartbeat = serializeHeartbeat();

    expect(heartbeat).toMatch(/^: heartbeat \d+\n\n$/);
  });
});
```

---

### A8.1.2 Test stream ordering guarantees

```typescript
// src/lib/inference/__tests__/sse/registry.test.ts
import { describe, it, expect, beforeEach } from "@jest/globals";
import { InMemoryStreamRegistry } from "../../sse/registry";
import type { TokenEvent, ErrorEvent, DoneEvent } from "../../types";

describe("StreamRegistry ordering guarantees", () => {
  let registry: InMemoryStreamRegistry;

  beforeEach(() => {
    registry = new InMemoryStreamRegistry(60_000);
  });

  it("auto-closes stream on done event", () => {
    const stream = registry.create("test-request");

    const doneEvent: DoneEvent = {
      type: "done",
      timestamp: Date.now(),
      data: { result: null },
    };

    registry.publish("test-request", doneEvent);

    expect(registry.getMetadata("test-request")?.closed).toBe(true);
  });

  it("ignores events after stream is closed", () => {
    registry.create("test-request");

    // Close the stream
    registry.close("test-request");

    // This should not throw
    const tokenEvent: TokenEvent = {
      type: "token",
      timestamp: Date.now(),
      data: { token: "ignored", index: 0 },
    };

    registry.publish("test-request", tokenEvent);

    expect(registry.getMetadata("test-request")?.eventCount).toBe(0);
  });

  it("tracks event count correctly", () => {
    registry.create("test-request");

    for (let i = 0; i < 5; i++) {
      registry.publish("test-request", {
        type: "token",
        timestamp: Date.now(),
        data: { token: `token-${i}`, index: i },
      });
    }

    expect(registry.getMetadata("test-request")?.eventCount).toBe(5);
  });
});
```

---

### A8.1.3 Test client disconnect handling

```typescript
// src/lib/inference/__tests__/sse/disconnect.test.ts
import { describe, it, expect, jest } from "@jest/globals";
import { StreamPublisher } from "../../sse/publisher";
import { streamRegistry } from "../../sse/registry";

describe("Client disconnect handling", () => {
  it("publisher handles closed stream gracefully", () => {
    const requestId = "disconnect-test";
    streamRegistry.create(requestId);

    const publisher = new StreamPublisher(requestId);

    // Simulate client disconnect
    streamRegistry.close(requestId);

    // Should not throw
    expect(() => publisher.emitToken("after disconnect")).not.toThrow();
  });

  it("emitDone is safe to call after close", () => {
    const requestId = "done-after-close";
    streamRegistry.create(requestId);

    const publisher = new StreamPublisher(requestId);
    streamRegistry.close(requestId);

    // Should not throw
    expect(() => publisher.emitDone(null)).not.toThrow();
  });
});
```

---

## A8.2 Adapter Validation

### A8.2.1 Test adapter contract compliance

```typescript
// src/lib/inference/__tests__/adapters/contract.test.ts
import { describe, it, expect } from "@jest/globals";
import type { ProviderAdapter, InferenceRequest, ResolvedProvider } from "../../types";

/**
 * Contract test suite that all adapters must pass.
 */
export function testAdapterContract(
  name: string,
  createAdapter: () => ProviderAdapter
) {
  describe(`${name} adapter contract`, () => {
    let adapter: ProviderAdapter;

    beforeEach(() => {
      adapter = createAdapter();
    });

    it("has a non-empty providerId", () => {
      expect(adapter.providerId).toBeTruthy();
      expect(typeof adapter.providerId).toBe("string");
    });

    it("reports capabilities", () => {
      expect(adapter.capabilities).toBeDefined();
      expect(typeof adapter.capabilities.supportsStreaming).toBe("boolean");
      expect(typeof adapter.capabilities.maxContextLength).toBe("number");
      expect(Array.isArray(adapter.capabilities.supportedModels)).toBe(true);
    });

    it("generate() returns an AsyncGenerator", async () => {
      const request: InferenceRequest = {
        requestId: "test",
        messages: [{ role: "user", content: "test" }],
        options: { stream: true },
      };

      const provider: ResolvedProvider = {
        providerId: adapter.providerId,
        modelId: adapter.capabilities.supportedModels[0] ?? "test-model",
      };

      const generator = adapter.generate(request, provider);

      expect(generator[Symbol.asyncIterator]).toBeDefined();
    });

    it("healthCheck() returns a boolean", async () => {
      const result = await adapter.healthCheck();
      expect(typeof result).toBe("boolean");
    });
  });
}
```

---

### A8.2.2 Test error normalization

```typescript
// src/lib/inference/__tests__/adapters/errors.test.ts
import { describe, it, expect } from "@jest/globals";
import { BaseAdapter } from "../../adapters/base";

class TestAdapter extends BaseAdapter {
  readonly providerId = "test";
  readonly capabilities = {
    supportsStreaming: true,
    maxContextLength: 4096,
    supportedModels: ["test-model"],
    supportsTools: false,
  };

  async *generate() {
    yield this.createTokenEvent("test", 0);
    return { promptTokens: 0, completionTokens: 1, ttfbMs: 0, totalMs: 0, retryCount: 0 };
  }

  async healthCheck() {
    return true;
  }
}

describe("Error normalization", () => {
  const adapter = new TestAdapter();

  it("maps 401 to auth_error", () => {
    const kind = adapter["mapHttpStatusToErrorKind"](401);
    expect(kind).toBe("auth_error");
  });

  it("maps 403 to auth_error", () => {
    const kind = adapter["mapHttpStatusToErrorKind"](403);
    expect(kind).toBe("auth_error");
  });

  it("maps 429 to rate_limit", () => {
    const kind = adapter["mapHttpStatusToErrorKind"](429);
    expect(kind).toBe("rate_limit");
  });

  it("maps 404 to model_not_found", () => {
    const kind = adapter["mapHttpStatusToErrorKind"](404);
    expect(kind).toBe("model_not_found");
  });

  it("maps 500+ to provider_error", () => {
    expect(adapter["mapHttpStatusToErrorKind"](500)).toBe("provider_error");
    expect(adapter["mapHttpStatusToErrorKind"](502)).toBe("provider_error");
    expect(adapter["mapHttpStatusToErrorKind"](503)).toBe("provider_error");
  });

  it("maps unknown 4xx to internal_error", () => {
    expect(adapter["mapHttpStatusToErrorKind"](418)).toBe("internal_error");
  });
});
```

---

### A8.2.3 Test retryable error classification

```typescript
// src/lib/inference/__tests__/types/errors.test.ts
import { describe, it, expect } from "@jest/globals";
import {
  isRetryableError,
  shouldFallback,
  createExecutionError,
  createTimeoutError,
  createCancellationError,
} from "../../types";

describe("Error classification", () => {
  describe("isRetryableError", () => {
    it("returns true for rate_limit", () => {
      const error = createExecutionError("rate_limit", "Rate limited", "test");
      expect(isRetryableError(error)).toBe(true);
    });

    it("returns true for network_error", () => {
      const error = createExecutionError("network_error", "Network failed", "test");
      expect(isRetryableError(error)).toBe(true);
    });

    it("returns true for timeout", () => {
      const error = createTimeoutError("test", 60000);
      expect(isRetryableError(error)).toBe(true);
    });

    it("returns false for auth_error", () => {
      const error = createExecutionError("auth_error", "Unauthorized", "test");
      expect(isRetryableError(error)).toBe(false);
    });

    it("returns false for cancelled", () => {
      const error = createCancellationError("test");
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe("shouldFallback", () => {
    it("returns true for provider_error", () => {
      const error = createExecutionError("provider_error", "Provider failed", "test");
      expect(shouldFallback(error)).toBe(true);
    });

    it("returns true for model_not_found", () => {
      const error = createExecutionError("model_not_found", "Model not found", "test");
      expect(shouldFallback(error)).toBe(true);
    });

    it("returns false for auth_error", () => {
      const error = createExecutionError("auth_error", "Unauthorized", "test");
      expect(shouldFallback(error)).toBe(false);
    });

    it("returns false for context_length", () => {
      const error = createExecutionError("context_length", "Input too long", "test");
      expect(shouldFallback(error)).toBe(false);
    });
  });
});
```

---

## A8.3 Executor Validation

### A8.3.1 Test execution lifecycle

```typescript
// src/lib/inference/__tests__/executor/lifecycle.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { execute } from "../../executor";
import type { ExecutionInput, ProviderAdapter, TokenEvent } from "../../types";
import { providerRegistry } from "../../adapters/registry";

// Mock adapter
const mockAdapter: ProviderAdapter = {
  providerId: "mock",
  capabilities: {
    supportsStreaming: true,
    maxContextLength: 4096,
    supportedModels: ["mock-model"],
    supportsTools: false,
  },
  async *generate(request, provider) {
    yield { type: "token", timestamp: Date.now(), data: { token: "Hello", index: 0 } };
    yield { type: "token", timestamp: Date.now(), data: { token: " World", index: 1 } };
    return { promptTokens: 10, completionTokens: 2, ttfbMs: 50, totalMs: 100, retryCount: 0 };
  },
  async healthCheck() {
    return true;
  },
};

describe("Executor lifecycle", () => {
  beforeEach(() => {
    providerRegistry.register(mockAdapter);
  });

  it("executes successfully with mock adapter", async () => {
    const input: ExecutionInput = {
      request: {
        requestId: "test-lifecycle",
        messages: [{ role: "user", content: "Hello" }],
        options: { stream: true },
      },
      routingPlan: {
        primary: { providerId: "mock", modelId: "mock-model" },
        fallbacks: [],
        snapshot: { resolvedAt: new Date(), strategy: "pinned", originalAlias: "mock" },
      },
      controls: { timeoutMs: 60000, maxRetries: 1 },
    };

    const result = await execute(input);

    expect(result.success).toBe(true);
    expect(result.resolvedProvider.providerId).toBe("mock");
    expect(result.metrics.completionTokens).toBe(2);
    expect(result.fallbackCount).toBe(0);
  });
});
```

---

### A8.3.2 Test retry behavior

```typescript
// src/lib/inference/__tests__/executor/retry.test.ts
import { describe, it, expect, jest } from "@jest/globals";

describe("Executor retry behavior", () => {
  it("retries on retryable error", async () => {
    let attempts = 0;

    const failThenSucceedAdapter = {
      providerId: "retry-test",
      capabilities: { supportsStreaming: true, maxContextLength: 4096, supportedModels: ["test"], supportsTools: false },
      async *generate() {
        attempts++;
        if (attempts === 1) {
          yield {
            type: "error" as const,
            timestamp: Date.now(),
            data: {
              error: { kind: "rate_limit" as const, message: "Rate limited", providerId: "retry-test", retryable: true },
            },
          };
          return { promptTokens: 0, completionTokens: 0, ttfbMs: 0, totalMs: 0, retryCount: 0 };
        }
        yield { type: "token" as const, timestamp: Date.now(), data: { token: "Success", index: 0 } };
        return { promptTokens: 10, completionTokens: 1, ttfbMs: 50, totalMs: 100, retryCount: 1 };
      },
      async healthCheck() {
        return true;
      },
    };

    // Test would register adapter and verify retry count
    expect(attempts).toBe(0); // Placeholder - actual test would run execution
  });

  it("does not retry on non-retryable error", async () => {
    // Similar test structure for auth_error which should not retry
  });
});
```

---

### A8.3.3 Test cancellation handling

```typescript
// src/lib/inference/__tests__/executor/cancellation.test.ts
import { describe, it, expect } from "@jest/globals";
import { execute } from "../../executor";
import type { ExecutionInput } from "../../types";

describe("Executor cancellation", () => {
  it("respects AbortSignal", async () => {
    const controller = new AbortController();

    const input: ExecutionInput = {
      request: {
        requestId: "cancel-test",
        messages: [{ role: "user", content: "Hello" }],
        options: { stream: true },
      },
      routingPlan: {
        primary: { providerId: "slow-mock", modelId: "slow-model" },
        fallbacks: [],
        snapshot: { resolvedAt: new Date(), strategy: "pinned", originalAlias: "slow" },
      },
      controls: {
        timeoutMs: 60000,
        maxRetries: 0,
        signal: controller.signal,
      },
    };

    // Abort immediately
    controller.abort();

    const result = await execute(input);

    expect(result.success).toBe(false);
    expect(result.error?.kind).toBe("cancelled");
  });

  it("times out after timeoutMs", async () => {
    const input: ExecutionInput = {
      request: {
        requestId: "timeout-test",
        messages: [{ role: "user", content: "Hello" }],
        options: { stream: true },
      },
      routingPlan: {
        primary: { providerId: "slow-mock", modelId: "slow-model" },
        fallbacks: [],
        snapshot: { resolvedAt: new Date(), strategy: "pinned", originalAlias: "slow" },
      },
      controls: {
        timeoutMs: 10, // Very short timeout
        maxRetries: 0,
      },
    };

    const result = await execute(input);

    expect(result.success).toBe(false);
    expect(result.error?.kind).toBe("timeout");
  });
});
```

---

## A8.4 Persistence Validation

### A8.4.1 Test attempt recording

```typescript
// src/lib/inference/__tests__/persistence/recording.test.ts
import { describe, it, expect, beforeEach } from "@jest/globals";
import type { ExecutionPersistence, ExecutionRecord } from "../../persistence/interface";

// In-memory implementation for testing
class InMemoryPersistence implements ExecutionPersistence {
  private records = new Map<string, ExecutionRecord>();

  async createRecord(requestId: string) {
    const record: ExecutionRecord = {
      requestId,
      attempts: [],
      finalProvider: null,
      finalSuccess: false,
      finalMetrics: null,
      finalError: null,
      createdAt: new Date(),
      completedAt: null,
    };
    this.records.set(requestId, record);
    return record;
  }

  // ... other methods
}

describe("Persistence recording", () => {
  let persistence: InMemoryPersistence;

  beforeEach(() => {
    persistence = new InMemoryPersistence();
  });

  it("creates execution record", async () => {
    const record = await persistence.createRecord("test-request");

    expect(record.requestId).toBe("test-request");
    expect(record.attempts).toHaveLength(0);
    expect(record.createdAt).toBeInstanceOf(Date);
  });
});
```

---

### A8.4.2 Test terminal state persistence

```typescript
// src/lib/inference/__tests__/persistence/terminal.test.ts
import { describe, it, expect } from "@jest/globals";
import { AsyncExecutionPersistence } from "../../persistence/async";

describe("Terminal state persistence", () => {
  it("awaits final outcome write", async () => {
    let writeCompleted = false;

    const mockPersistence = {
      createRecord: jest.fn(),
      recordAttemptStart: jest.fn(),
      recordAttemptCompletion: jest.fn(),
      recordFinalOutcome: jest.fn(async () => {
        await new Promise((r) => setTimeout(r, 10));
        writeCompleted = true;
        return {} as any;
      }),
      getRecord: jest.fn(),
    };

    const logger = jest.fn();
    const async = new AsyncExecutionPersistence(mockPersistence, logger);

    await async.recordFinalOutcome("test", {
      success: true,
      resolvedProvider: { providerId: "test", modelId: "test" },
      metrics: { promptTokens: 0, completionTokens: 0, ttfbMs: 0, totalMs: 0, retryCount: 0 },
      error: null,
      fallbackCount: 0,
    });

    expect(writeCompleted).toBe(true);
  });

  it("logs but does not throw on write failure", async () => {
    const mockPersistence = {
      createRecord: jest.fn(),
      recordAttemptStart: jest.fn(),
      recordAttemptCompletion: jest.fn(),
      recordFinalOutcome: jest.fn(async () => {
        throw new Error("Database error");
      }),
      getRecord: jest.fn(),
    };

    const logger = jest.fn();
    const async = new AsyncExecutionPersistence(mockPersistence, logger);

    // Should not throw
    await expect(
      async.recordFinalOutcome("test", {
        success: true,
        resolvedProvider: { providerId: "test", modelId: "test" },
        metrics: { promptTokens: 0, completionTokens: 0, ttfbMs: 0, totalMs: 0, retryCount: 0 },
        error: null,
        fallbackCount: 0,
      })
    ).resolves.not.toThrow();

    // Logger should be called
    expect(logger).toHaveBeenCalled();
  });
});
```

---

## A8.5 End-to-End Validation

### A8.5.1 Integration test setup

```typescript
// src/lib/inference/__tests__/e2e/setup.ts
import { providerRegistry, initializeProviders } from "../../adapters/registry";
import { initializeInference } from "../../config/startup";

/**
 * Setup function for e2e tests.
 * Only runs if required environment variables are present.
 */
export function setupE2ETests(): boolean {
  try {
    initializeInference();
    initializeProviders();
    return true;
  } catch (error) {
    console.warn("E2E tests skipped: ", (error as Error).message);
    return false;
  }
}

/**
 * Get available providers for e2e testing.
 */
export function getTestProviders(): string[] {
  return providerRegistry.list();
}
```

---

### A8.5.2 Full inference e2e test

```typescript
// src/lib/inference/__tests__/e2e/inference.test.ts
import { describe, it, expect, beforeAll } from "@jest/globals";
import { setupE2ETests, getTestProviders } from "./setup";
import { execute } from "../../executor";
import { streamRegistry } from "../../sse/registry";
import type { ExecutionInput, StreamEvent } from "../../types";

describe("E2E: Full inference flow", () => {
  let providers: string[];

  beforeAll(() => {
    if (!setupE2ETests()) {
      return;
    }
    providers = getTestProviders();
  });

  it.skipIf(() => providers.length === 0)(
    "executes inference and streams tokens",
    async () => {
      const requestId = `e2e-test-${Date.now()}`;

      // Create stream to capture events
      const stream = streamRegistry.create(requestId);
      const events: StreamEvent[] = [];

      // Collect events in background
      const collectPromise = (async () => {
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          events.push(value);
        }
      })();

      const input: ExecutionInput = {
        request: {
          requestId,
          messages: [{ role: "user", content: "Say hello in exactly 3 words." }],
          options: { maxTokens: 50, temperature: 0, stream: true },
        },
        routingPlan: {
          primary: { providerId: providers[0], modelId: "gpt-4o-mini" },
          fallbacks: [],
          snapshot: { resolvedAt: new Date(), strategy: "e2e-test", originalAlias: "test" },
        },
        controls: { timeoutMs: 30000, maxRetries: 1 },
      };

      const result = await execute(input);
      await collectPromise;

      expect(result.success).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === "token")).toBe(true);
      expect(events[events.length - 1].type).toBe("done");
    }
  );
});
```

---

### A8.5.3 Error handling e2e test

```typescript
// src/lib/inference/__tests__/e2e/errors.test.ts
import { describe, it, expect, beforeAll } from "@jest/globals";
import { setupE2ETests } from "./setup";
import { execute } from "../../executor";
import type { ExecutionInput } from "../../types";

describe("E2E: Error handling", () => {
  beforeAll(() => {
    setupE2ETests();
  });

  it("handles invalid model gracefully", async () => {
    const input: ExecutionInput = {
      request: {
        requestId: `e2e-error-${Date.now()}`,
        messages: [{ role: "user", content: "Hello" }],
        options: { stream: true },
      },
      routingPlan: {
        primary: { providerId: "openai", modelId: "nonexistent-model-xyz" },
        fallbacks: [],
        snapshot: { resolvedAt: new Date(), strategy: "test", originalAlias: "test" },
      },
      controls: { timeoutMs: 30000, maxRetries: 0 },
    };

    const result = await execute(input);

    expect(result.success).toBe(false);
    expect(result.error).not.toBeNull();
    expect(["model_not_found", "provider_error"]).toContain(result.error?.kind);
  });

  it("handles timeout correctly", async () => {
    const input: ExecutionInput = {
      request: {
        requestId: `e2e-timeout-${Date.now()}`,
        messages: [{ role: "user", content: "Write a 1000 word essay." }],
        options: { maxTokens: 4000, stream: true },
      },
      routingPlan: {
        primary: { providerId: "openai", modelId: "gpt-4o" },
        fallbacks: [],
        snapshot: { resolvedAt: new Date(), strategy: "test", originalAlias: "test" },
      },
      controls: { timeoutMs: 100, maxRetries: 0 }, // Very short timeout
    };

    const result = await execute(input);

    expect(result.success).toBe(false);
    expect(result.error?.kind).toBe("timeout");
  });
});
```

---

## Tasks

> **Note**: Detailed unit test specifications are in each section (A2.8, A3.6, A4.6, A5.5, A6.5, A7.4).
> A8 focuses on E2E tests and cross-cutting test infrastructure.

### A8.1 Test Infrastructure

- [ ] **A8.1.1 Set up Vitest configuration for inference tests**
- [ ] **A8.1.2 Create mock adapter factory for testing**
- [ ] **A8.1.3 Create in-memory persistence for testing**
- [ ] **A8.1.4 Create test utilities (mock stream, mock publisher)**

### A8.2 E2E Test Setup

- [ ] **A8.2.1 Create e2e test setup with conditional provider init**
- [ ] **A8.2.2 Create test helpers for e2e (skip if no credentials)**
- [ ] **A8.2.3 Create cleanup utilities for test isolation**

### A8.3 E2E Test Suites

- [ ] **A8.3.1 Full inference flow with real provider** (OpenAI if available)
- [ ] **A8.3.2 Error handling with invalid model**
- [ ] **A8.3.3 Timeout handling with short timeout**
- [ ] **A8.3.4 Cancellation mid-stream**
- [ ] **A8.3.5 Telemetry emission verification**

### A8.4 UI Test Pages

> Test pages provide visual verification for behaviors that are hard to unit test.

- [ ] **A8.4.1 Create test route group: `app/(test)/test/`**
- [ ] **A8.4.2 Streaming test page** (see A3.7)
- [ ] **A8.4.3 Adapter test page** (see A4.8)
- [ ] **A8.4.4 Executor test page** (see A5.6)
- [ ] **A8.4.5 Create index page listing all test pages**

---

## Testing Strategy Summary

| Section | Unit Tests | Integration Tests | UI Test Page |
|---------|-----------|-------------------|--------------|
| A2 Types | A2.8 | - | - |
| A3 SSE | A3.6 | - | A3.7 (`/test/streaming`) |
| A4 Adapters | A4.6 | A4.7 (requires API keys) | A4.8 (`/test/adapters`) |
| A5 Executor | A5.5 | - | A5.6 (`/test/executor`) |
| A6 Persistence | A6.5 | A6.6 (requires DB) | - |
| A7 Configuration | A7.4 | - | - |
| A8 E2E | - | A8.3 | A8.4 (`/test/` index) |
