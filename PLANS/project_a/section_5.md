# A5 — Inference Executor

> **Purpose**: The orchestration spine that coordinates routing, provider execution, streaming, fallback, and persistence.

**Depends on**:
- A2 (Types) — uses `ExecutionInput`, `ExecutionResult`, `ExecutionControls`, `RoutingPlan`
- A3 (SSE) — uses `StreamPublisher`
- A4 (Adapters) — uses `providerRegistry`, `ProviderAdapter`

**File location**: `src/lib/inference/executor/`

---

## A5.1 Executor API

### A5.1.1 Define the execute function

The main entry point for inference execution:

```typescript
// src/lib/inference/executor/index.ts
import type {
  ExecutionInput,
  ExecutionResult,
  ExecutionMetrics,
  ResolvedProvider,
  ExecutionError,
} from "../types";
import { StreamPublisher } from "../sse/publisher";
import { providerRegistry } from "../adapters/registry";
import {
  isRetryableError,
  shouldFallback,
  createTimeoutError,
  createCancellationError,
  createExecutionError,
} from "../types";
import {
  emitExecutionStarted,
  emitExecutionCompleted,
  emitExecutionFailed,
} from "../adapters/telemetry";

/**
 * Execute an inference request.
 *
 * This is the main entry point for Project A.
 * It receives an ExecutionInput (from Project C via Project B)
 * and streams results via SSE.
 *
 * @returns ExecutionResult after streaming completes
 */
export async function execute(input: ExecutionInput): Promise<ExecutionResult> {
  const { request, routingPlan, controls } = input;
  const publisher = new StreamPublisher(request.requestId);

  // Build provider chain: primary + fallbacks
  const providerChain = [routingPlan.primary, ...routingPlan.fallbacks];
  let fallbackCount = 0;
  let lastError: ExecutionError | null = null;

  for (const provider of providerChain) {
    const result = await executeWithProvider(
      input,
      provider,
      publisher,
      fallbackCount
    );

    if (result.success) {
      publisher.emitMetadata("completion", result.metrics);
      publisher.emitDone(result);
      return result;
    }

    // Execution failed
    lastError = result.error;

    // Check if we should fallback
    if (lastError && shouldFallback(lastError) && fallbackCount < providerChain.length - 1) {
      fallbackCount++;
      continue; // Try next provider
    }

    // No more fallbacks or error is not fallback-eligible
    break;
  }

  // All providers failed
  const failureResult: ExecutionResult = {
    success: false,
    resolvedProvider: providerChain[fallbackCount],
    metrics: { promptTokens: 0, completionTokens: 0, ttfbMs: 0, totalMs: 0, retryCount: 0 },
    error: lastError,
    fallbackCount,
  };

  if (lastError) {
    publisher.emitError(lastError);
  }
  publisher.emitDone(failureResult);

  return failureResult;
}
```

---

### A5.1.2 Execute with single provider

```typescript
// src/lib/inference/executor/index.ts (continued)

async function executeWithProvider(
  input: ExecutionInput,
  provider: ResolvedProvider,
  publisher: StreamPublisher,
  fallbackCount: number
): Promise<ExecutionResult> {
  const { request, controls } = input;
  const { timeoutMs, maxRetries, signal } = controls;

  const adapter = providerRegistry.get(provider.providerId);
  if (!adapter) {
    return {
      success: false,
      resolvedProvider: provider,
      metrics: { promptTokens: 0, completionTokens: 0, ttfbMs: 0, totalMs: 0, retryCount: 0 },
      error: createExecutionError(
        "internal_error",
        `Provider not found: ${provider.providerId}`,
        provider.providerId
      ),
      fallbackCount,
    };
  }

  // Emit telemetry
  emitExecutionStarted(request.requestId, provider.providerId, provider.modelId);

  let retryCount = 0;
  let lastError: ExecutionError | null = null;

  while (retryCount <= maxRetries) {
    try {
      const result = await executeAttempt(
        adapter,
        request,
        provider,
        publisher,
        timeoutMs,
        signal
      );

      if (result.success) {
        emitExecutionCompleted(
          request.requestId,
          provider.providerId,
          provider.modelId,
          result.metrics
        );
        return { ...result, fallbackCount, retryCount };
      }

      // Check if error is retryable
      lastError = result.error;
      if (lastError && isRetryableError(lastError) && retryCount < maxRetries) {
        retryCount++;
        continue;
      }

      break;
    } catch (error) {
      lastError = createExecutionError(
        "internal_error",
        String(error),
        provider.providerId
      );
      break;
    }
  }

  // Provider failed after retries
  if (lastError) {
    emitExecutionFailed(
      request.requestId,
      provider.providerId,
      provider.modelId,
      lastError
    );
  }

  return {
    success: false,
    resolvedProvider: provider,
    metrics: { promptTokens: 0, completionTokens: 0, ttfbMs: 0, totalMs: 0, retryCount },
    error: lastError,
    fallbackCount,
  };
}
```

---

## A5.2 Execution Attempt

### A5.2.1 Single execution attempt with timeout

```typescript
// src/lib/inference/executor/attempt.ts
import type {
  ProviderAdapter,
  InferenceRequest,
  ResolvedProvider,
  ExecutionResult,
  ExecutionMetrics,
  ExecutionError,
  TokenEvent,
  ErrorEvent,
} from "../types";
import { StreamPublisher } from "../sse/publisher";
import { createTimeoutError, createCancellationError } from "../types";

interface AttemptResult {
  success: boolean;
  metrics: ExecutionMetrics;
  error: ExecutionError | null;
}

export async function executeAttempt(
  adapter: ProviderAdapter,
  request: InferenceRequest,
  provider: ResolvedProvider,
  publisher: StreamPublisher,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<AttemptResult> {
  // Create timeout abort controller
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Combine with external signal
  const combinedSignal = signal
    ? combineAbortSignals(signal, timeoutController.signal)
    : timeoutController.signal;

  try {
    const generator = adapter.generate(request, provider, combinedSignal);
    let lastError: ExecutionError | null = null;

    for await (const event of generator) {
      if (event.type === "token") {
        publisher.emitToken(event.data.token);
      } else if (event.type === "error") {
        lastError = event.data.error;
      }
    }

    // Generator returns metrics on completion
    const metrics = await getGeneratorReturn(generator);

    if (lastError) {
      return { success: false, metrics, error: lastError };
    }

    return { success: true, metrics, error: null };
  } catch (error) {
    if (timeoutController.signal.aborted) {
      return {
        success: false,
        metrics: emptyMetrics(),
        error: createTimeoutError(provider.providerId, timeoutMs),
      };
    }

    if (signal?.aborted) {
      return {
        success: false,
        metrics: emptyMetrics(),
        error: createCancellationError(provider.providerId),
      };
    }

    return {
      success: false,
      metrics: emptyMetrics(),
      error: {
        kind: "internal_error",
        message: String(error),
        providerId: provider.providerId,
        retryable: false,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function emptyMetrics(): ExecutionMetrics {
  return { promptTokens: 0, completionTokens: 0, ttfbMs: 0, totalMs: 0, retryCount: 0 };
}

async function getGeneratorReturn<T, R>(
  generator: AsyncGenerator<T, R, undefined>
): Promise<R> {
  // Drain the generator to get return value
  let result = await generator.next();
  while (!result.done) {
    result = await generator.next();
  }
  return result.value;
}

function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}
```

---

## A5.3 Cancellation Handling

### A5.3.1 Handle cancellation from Gateway

```typescript
// Cancellation flows through the AbortSignal in ExecutionControls:
//
// Project C (Gateway)
//     │
//     │ AbortController.abort()
//     ▼
// ExecutionInput.controls.signal
//     │
//     ▼
// Executor (checks signal.aborted)
//     │
//     ▼
// Adapter (passes signal to fetch/SDK)
//     │
//     ▼
// Request aborted

// Example usage from Gateway:
const controller = new AbortController();

// Start execution
const resultPromise = execute({
  request,
  routingPlan,
  controls: {
    signal: controller.signal,
    timeoutMs: 60_000,
    maxRetries: 1,
  },
});

// Later, if user cancels:
controller.abort();
```

---

## A5.4 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         execute()                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input: ExecutionInput                                           │
│    ├─ request: InferenceRequest                                  │
│    ├─ routingPlan: RoutingPlan (from Project B)                  │
│    └─ controls: ExecutionControls                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ For each provider in [primary, ...fallbacks]:               │ │
│  │                                                             │ │
│  │   ┌───────────────────────────────────────────────────────┐ │ │
│  │   │ executeWithProvider()                                 │ │ │
│  │   │                                                       │ │ │
│  │   │   ┌─────────────────────────────────────────────────┐ │ │ │
│  │   │   │ executeAttempt() [with retries]                 │ │ │ │
│  │   │   │                                                 │ │ │ │
│  │   │   │   adapter.generate() → TokenEvent | ErrorEvent  │ │ │ │
│  │   │   │         │                                       │ │ │ │
│  │   │   │         ▼                                       │ │ │ │
│  │   │   │   publisher.emitToken()                         │ │ │ │
│  │   │   │         │                                       │ │ │ │
│  │   │   │         ▼                                       │ │ │ │
│  │   │   │   SSE Stream → Client                           │ │ │ │
│  │   │   └─────────────────────────────────────────────────┘ │ │ │
│  │   │                                                       │ │ │
│  │   │   Success? ──► Return result                          │ │ │
│  │   │   Failure + retryable? ──► Retry                      │ │ │
│  │   │   Failure + not retryable? ──► Return error           │ │ │
│  │   └───────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │   Success? ──► publisher.emitDone(result)                   │ │
│  │   Failure + fallback? ──► Try next provider                 │ │
│  │   Failure + no fallback? ──► publisher.emitError + emitDone │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Output: ExecutionResult                                         │
│    ├─ success: boolean                                           │
│    ├─ resolvedProvider: ResolvedProvider                         │
│    ├─ metrics: ExecutionMetrics                                  │
│    ├─ error: ExecutionError | null                               │
│    └─ fallbackCount: number                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tasks

### A5.1 Executor API

- [ ] **A5.1.1 Implement execute() main function**
- [ ] **A5.1.2 Implement executeWithProvider()**
- [ ] **A5.1.3 Implement fallback logic**

### A5.2 Execution attempt

- [ ] **A5.2.1 Implement executeAttempt()**
- [ ] **A5.2.2 Implement timeout handling**
- [ ] **A5.2.3 Implement retry logic**

### A5.3 Cancellation

- [ ] **A5.3.1 Implement AbortSignal propagation**
- [ ] **A5.3.2 Implement combineAbortSignals()**
- [ ] **A5.3.3 Handle cancellation cleanup**

### A5.4 Telemetry integration

- [ ] **A5.4.1 Emit execution_started on attempt start**
- [ ] **A5.4.2 Emit execution_completed on success**
- [ ] **A5.4.3 Emit execution_failed on failure**

---

## A5.5 Unit Tests

**File**: `src/lib/inference/__tests__/executor/`

All executor tests use mock adapters to avoid external dependencies.

- [ ] **A5.5.1 Test successful execution** (`execute.test.ts`)
      - `execute` returns success=true with mock adapter that yields tokens
      - `execute` returns correct metrics from adapter
      - `execute` emits tokens via publisher
      - `execute` emits completion metadata before done
      - `execute` emits done event with result

- [ ] **A5.5.2 Test retry behavior** (`retry.test.ts`)
      - Retries on rate_limit error
      - Retries on network_error
      - Retries on timeout error
      - Does NOT retry on auth_error
      - Does NOT retry on cancelled
      - Respects maxRetries limit
      - retryCount in result reflects actual retries

- [ ] **A5.5.3 Test fallback behavior** (`fallback.test.ts`)
      - Falls back on provider_error
      - Falls back on model_not_found
      - Falls back on rate_limit (after retries exhausted)
      - Does NOT fallback on auth_error
      - Does NOT fallback on context_length
      - fallbackCount reflects providers tried
      - Uses next provider in chain on fallback

- [ ] **A5.5.4 Test cancellation** (`cancellation.test.ts`)
      - Respects AbortSignal passed in controls
      - Returns cancelled error when signal aborted
      - Propagates signal to adapter
      - Cleans up properly on cancellation

- [ ] **A5.5.5 Test timeout** (`timeout.test.ts`)
      - Returns timeout error after timeoutMs
      - Timeout error includes provider ID and timeout value
      - Timeout triggers retry (timeout is retryable)
      - Clears timeout on successful completion

- [ ] **A5.5.6 Test helper functions** (`helpers.test.ts`)
      - `combineAbortSignals` aborts if any signal aborts
      - `combineAbortSignals` handles already-aborted signals
      - `emptyMetrics` returns zeroed metrics
      - `getGeneratorReturn` extracts return value from generator

---

## A5.6 UI Test Page

**Route**: `app/(test)/test/executor/page.tsx`

End-to-end execution test page:

- [ ] **A5.6.1 Create executor test page**
      - Form: Prompt input, model selection
      - Checkbox: Enable fallbacks (add secondary provider)
      - Checkbox: Force error (use invalid model)
      - Slider: Timeout setting (1s - 60s)
      - Button: "Execute" - runs full execution
      - Button: "Cancel" - aborts in-flight request
      - Display: Streaming tokens as they arrive
      - Display: Execution result (success, metrics, fallbackCount)
      - Display: Event timeline (telemetry events)

- [ ] **A5.6.2 Create executor test endpoint**
      - `app/api/test/execute/route.ts` - full executor test
      - Accepts ExecutionInput or simplified form
      - Returns SSE stream of execution
      - Supports cancellation via request abort
