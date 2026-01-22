# A2 — Inference Contracts & Types

> **Purpose**: Define the TypeScript types and contracts that form the foundation for all of Project A. These types are consumed by Sections A3 (SSE), A4 (Adapters), and A5 (Executor).

**File location**: `src/lib/inference/types.ts`

---

## A2.1 Message and Request Types

### A2.1.1 Define message types

Messages follow the OpenAI-compatible format but are provider-agnostic.

```typescript
// src/lib/inference/types.ts

export type MessageRole = "system" | "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
  // Future: tool_calls, tool_call_id for function calling
}
```

**Constraints:**
- `content` must be non-empty string
- `role` is strictly typed (no arbitrary strings)

---

### A2.1.2 Define inference options

Options that can be passed to any provider. Provider-specific options are handled separately.

```typescript
export interface InferenceOptions {
  /** Maximum tokens to generate. Provider default if not specified. */
  maxTokens?: number;

  /** Sampling temperature (0-2). Provider default if not specified. */
  temperature?: number;

  /** Stop sequences. Empty array means no stop sequences. */
  stopSequences?: string[];

  /** Whether to stream tokens. Default: true (streaming-first). */
  stream?: boolean;
}

/** Default options applied when not specified */
export const DEFAULT_INFERENCE_OPTIONS: Required<Pick<InferenceOptions, "stream">> = {
  stream: true,
};
```

---

### A2.1.3 Define inference request (internal)

This is what Project A receives after Project B has resolved routing.

```typescript
/**
 * Internal inference request — already has routing resolved.
 * This is NOT the public API request shape (that's Project C).
 */
export interface InferenceRequest {
  /** Unique request identifier (from Project C) */
  requestId: string;

  /** Messages to send to the model */
  messages: Message[];

  /** Inference options */
  options: InferenceOptions;
}
```

**Note**: This type intentionally excludes:
- `tenantId` — owned by Project C
- `modelAlias` — resolved by Project B before reaching A
- Quota/billing info — owned by Project C/F

---

## A2.2 Routing Plan Contract

### A2.2.1 Define routing plan (from Project B)

The routing plan is what Project B produces and Project A consumes.

```typescript
/**
 * Resolved routing plan from Project B.
 * Contains everything needed to execute inference.
 */
export interface RoutingPlan {
  /** Primary provider to use */
  primary: ResolvedProvider;

  /** Fallback providers if primary fails (ordered) */
  fallbacks: ResolvedProvider[];

  /** Snapshot metadata for replay/debugging */
  snapshot: {
    resolvedAt: Date;
    strategy: string; // e.g., "cheapest", "fastest", "pinned"
    originalAlias: string;
  };
}

export interface ResolvedProvider {
  /** Provider identifier (e.g., "openai", "ollama") */
  providerId: string;

  /** Model identifier for this provider (e.g., "gpt-4o", "llama3.2") */
  modelId: string;

  /** Provider-specific options (validated JSON) */
  providerOptions?: Record<string, unknown>;
}
```

---

## A2.3 Execution Input/Output Contracts

### A2.3.1 Define execution input

What the Executor (A5) receives to begin execution.

```typescript
/**
 * Complete input to the executor.
 * Combines the inference request with resolved routing.
 */
export interface ExecutionInput {
  /** The inference request */
  request: InferenceRequest;

  /** Resolved routing plan from Project B */
  routingPlan: RoutingPlan;

  /** Execution controls */
  controls: ExecutionControls;
}

export interface ExecutionControls {
  /** AbortSignal for cancellation (from Project C) */
  signal?: AbortSignal;

  /** Timeout in milliseconds. Default: 60000 (60s) */
  timeoutMs: number;

  /** Max retries within same provider. Default: 1 */
  maxRetries: number;
}

export const DEFAULT_EXECUTION_CONTROLS: ExecutionControls = {
  timeoutMs: 60_000,
  maxRetries: 1,
};
```

---

### A2.3.2 Define execution result

What the Executor returns after completion.

```typescript
/**
 * Result of a completed execution.
 * Returned after streaming is complete.
 */
export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Provider that was actually used (may differ from primary if fallback) */
  resolvedProvider: ResolvedProvider;

  /** Metrics from execution */
  metrics: ExecutionMetrics;

  /** Error if failed (null on success) */
  error: ExecutionError | null;

  /** Number of fallback attempts before success/failure */
  fallbackCount: number;
}

export interface ExecutionMetrics {
  /** Total tokens in prompt */
  promptTokens: number;

  /** Total tokens generated */
  completionTokens: number;

  /** Time to first token in ms */
  ttfbMs: number;

  /** Total execution time in ms */
  totalMs: number;

  /** Number of retry attempts within provider */
  retryCount: number;
}
```

---

## A2.4 Stream Event Types

### A2.4.1 Define SSE event types

These types are used by Section A3 (SSE Engine) and emitted by adapters.

```typescript
/**
 * All possible stream event types.
 * Used for SSE event: field.
 */
export type StreamEventType = "token" | "metadata" | "error" | "done";

/**
 * Base interface for all stream events.
 */
interface BaseStreamEvent {
  type: StreamEventType;
  timestamp: number; // Unix ms
}

/**
 * Token event — emitted for each chunk of generated text.
 */
export interface TokenEvent extends BaseStreamEvent {
  type: "token";
  data: {
    /** The token text */
    token: string;
    /** Token index in sequence (0-based) */
    index: number;
  };
}

/**
 * Metadata event — emitted at key points (first token, completion).
 */
export interface MetadataEvent extends BaseStreamEvent {
  type: "metadata";
  data: {
    kind: "first_token" | "completion";
    metrics?: Partial<ExecutionMetrics>;
  };
}

/**
 * Error event — emitted when execution fails.
 */
export interface ErrorEvent extends BaseStreamEvent {
  type: "error";
  data: {
    error: ExecutionError;
  };
}

/**
 * Done event — always the final event in a stream.
 */
export interface DoneEvent extends BaseStreamEvent {
  type: "done";
  data: {
    /** Final execution result (may be partial if errored) */
    result: ExecutionResult | null;
  };
}

/**
 * Union of all stream events.
 */
export type StreamEvent = TokenEvent | MetadataEvent | ErrorEvent | DoneEvent;
```

**Stream ordering guarantees (enforced by A3):**
1. Zero or more `token` events
2. Optional `metadata` events (first_token, completion)
3. Optional `error` event (at most one)
4. Exactly one `done` event (always last)

---

## A2.5 Error Types

### A2.5.1 Define platform error kinds

```typescript
/**
 * Normalized error kinds across all providers.
 * Used for consistent error handling and retry logic.
 */
export type ErrorKind =
  | "provider_error"      // Provider returned an error
  | "rate_limit"          // Rate limited by provider
  | "auth_error"          // Authentication failed
  | "model_not_found"     // Model doesn't exist
  | "context_length"      // Input too long
  | "timeout"             // Request timed out
  | "cancelled"           // Request was cancelled
  | "network_error"       // Network connectivity issue
  | "internal_error";     // Platform internal error

/**
 * Execution error with normalized structure.
 */
export interface ExecutionError {
  /** Normalized error kind */
  kind: ErrorKind;

  /** Human-readable message */
  message: string;

  /** Provider that produced the error */
  providerId: string;

  /** Original error from provider (for debugging) */
  providerError?: {
    code?: string;
    message?: string;
    status?: number;
  };

  /** Whether this error is retryable */
  retryable: boolean;
}
```

---

### A2.5.2 Define retryable error classification

```typescript
/**
 * Errors that can trigger a retry within the same provider.
 */
export const RETRYABLE_ERROR_KINDS: Set<ErrorKind> = new Set([
  "rate_limit",
  "network_error",
  "timeout",
]);

/**
 * Errors that can trigger fallback to next provider.
 * Superset of retryable errors plus some provider-specific failures.
 */
export const FALLBACK_ERROR_KINDS: Set<ErrorKind> = new Set([
  "rate_limit",
  "network_error",
  "timeout",
  "provider_error",
  "model_not_found",
]);

/**
 * Check if an error should trigger retry.
 */
export function isRetryableError(error: ExecutionError): boolean {
  return error.retryable && RETRYABLE_ERROR_KINDS.has(error.kind);
}

/**
 * Check if an error should trigger fallback.
 */
export function shouldFallback(error: ExecutionError): boolean {
  return FALLBACK_ERROR_KINDS.has(error.kind);
}
```

---

### A2.5.3 Error factory functions

```typescript
/**
 * Create a normalized execution error.
 */
export function createExecutionError(
  kind: ErrorKind,
  message: string,
  providerId: string,
  providerError?: ExecutionError["providerError"]
): ExecutionError {
  return {
    kind,
    message,
    providerId,
    providerError,
    retryable: RETRYABLE_ERROR_KINDS.has(kind),
  };
}

/**
 * Create timeout error.
 */
export function createTimeoutError(
  providerId: string,
  timeoutMs: number
): ExecutionError {
  return createExecutionError(
    "timeout",
    `Request timed out after ${timeoutMs}ms`,
    providerId
  );
}

/**
 * Create cancellation error.
 */
export function createCancellationError(providerId: string): ExecutionError {
  return createExecutionError(
    "cancelled",
    "Request was cancelled",
    providerId
  );
}
```

---

## A2.6 Provider Adapter Types

### A2.6.1 Define adapter interface

This interface is implemented by all providers in Section A4.

```typescript
/**
 * Provider capabilities reported by each adapter.
 */
export interface ProviderCapabilities {
  /** Whether provider supports streaming */
  supportsStreaming: boolean;

  /** Maximum context length (tokens) */
  maxContextLength: number;

  /** Supported model IDs */
  supportedModels: string[];

  /** Whether provider supports function/tool calls */
  supportsTools: boolean;
}

/**
 * Adapter interface that all providers must implement.
 * Defined here, implemented in Section A4.
 */
export interface ProviderAdapter {
  /** Unique provider identifier */
  readonly providerId: string;

  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;

  /**
   * Execute inference and yield stream events.
   * @param request - The inference request
   * @param provider - Resolved provider configuration
   * @param signal - AbortSignal for cancellation
   */
  generate(
    request: InferenceRequest,
    provider: ResolvedProvider,
    signal?: AbortSignal
  ): AsyncGenerator<TokenEvent | ErrorEvent, ExecutionMetrics, undefined>;

  /**
   * Check if provider is healthy/reachable.
   */
  healthCheck(): Promise<boolean>;
}
```

---

## A2.7 Telemetry Types

### A2.7.1 Define telemetry event types

Telemetry emitted to Project D (Observability).

```typescript
/**
 * Telemetry event emitted for observability.
 * Project A emits these; Project D aggregates them.
 */
export interface TelemetryEvent {
  type: "execution_started" | "execution_completed" | "execution_failed";
  requestId: string;
  providerId: string;
  modelId: string;
  timestamp: number;

  /** Present for completed/failed events */
  metrics?: ExecutionMetrics;

  /** Present for failed events */
  error?: Pick<ExecutionError, "kind" | "message">;
}
```

---

## Summary: Type Dependencies

```
A2 (Types) ─────────────────────────────────────────────────
    │
    ├──► A3 (SSE Engine)
    │    Uses: StreamEvent, TokenEvent, ErrorEvent, DoneEvent
    │
    ├──► A4 (Adapters)
    │    Uses: ProviderAdapter, ProviderCapabilities, Message,
    │          InferenceRequest, ExecutionError, TokenEvent
    │
    ├──► A5 (Executor)
    │    Uses: ExecutionInput, ExecutionResult, ExecutionControls,
    │          RoutingPlan, ExecutionError, TelemetryEvent
    │
    └──► A6 (Persistence)
         Uses: ExecutionResult, ExecutionMetrics, ExecutionError
```

---

## Tasks

### A2.1 Core types

- [ ] **A2.1.1 Define Message and MessageRole types**
- [ ] **A2.1.2 Define InferenceOptions with defaults**
- [ ] **A2.1.3 Define InferenceRequest (internal)**

### A2.2 Routing plan contract

- [ ] **A2.2.1 Define RoutingPlan from Project B**
- [ ] **A2.2.2 Define ResolvedProvider type**

### A2.3 Execution contracts

- [ ] **A2.3.1 Define ExecutionInput and ExecutionControls**
- [ ] **A2.3.2 Define ExecutionResult and ExecutionMetrics**

### A2.4 Stream event types

- [ ] **A2.4.1 Define StreamEventType union**
- [ ] **A2.4.2 Define TokenEvent, MetadataEvent, ErrorEvent, DoneEvent**
- [ ] **A2.4.3 Document stream ordering guarantees**

### A2.5 Error types

- [ ] **A2.5.1 Define ErrorKind enum**
- [ ] **A2.5.2 Define ExecutionError interface**
- [ ] **A2.5.3 Define retryable/fallback classification**
- [ ] **A2.5.4 Create error factory functions**

### A2.6 Provider adapter types

- [ ] **A2.6.1 Define ProviderCapabilities interface**
- [ ] **A2.6.2 Define ProviderAdapter interface**

### A2.7 Telemetry types

- [ ] **A2.7.1 Define TelemetryEvent for Project D**

---

## A2.8 Unit Tests

**File**: `src/lib/inference/__tests__/types.test.ts`

- [ ] **A2.8.1 Create unit tests for error classification**
      - `isRetryableError` returns true for rate_limit, network_error, timeout
      - `isRetryableError` returns false for auth_error, cancelled, context_length
      - `shouldFallback` returns true for provider_error, model_not_found
      - `shouldFallback` returns false for auth_error, context_length

- [ ] **A2.8.2 Create unit tests for error factory functions**
      - `createExecutionError` sets retryable flag correctly
      - `createTimeoutError` creates timeout error with correct message
      - `createCancellationError` creates non-retryable cancelled error

- [ ] **A2.8.3 Create unit tests for default values**
      - `DEFAULT_INFERENCE_OPTIONS` has stream: true
      - `DEFAULT_EXECUTION_CONTROLS` has correct timeoutMs and maxRetries
