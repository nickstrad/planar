# A3 — SSE Streaming Engine

> **Purpose**: Provide a reliable, low-complexity streaming layer for delivering inference tokens to clients in real-time.

**Depends on**: A2 (Types) — uses `StreamEvent`, `TokenEvent`, `MetadataEvent`, `ErrorEvent`, `DoneEvent`

**File location**: `src/lib/inference/sse/`

---

## A3.1 SSE Protocol

### A3.1.1 Define supported event types

Uses the `StreamEventType` from A2:

```typescript
// Event types map directly to SSE event: field
// "token" | "metadata" | "error" | "done"

// SSE format:
// event: token
// data: {"type":"token","timestamp":1234567890,"data":{"token":"Hello"}}
```

---

### A3.1.2 Define SSE serialization

```typescript
// src/lib/inference/sse/serialize.ts
import type { StreamEvent } from "../types";

/**
 * Serialize a stream event to SSE format.
 */
export function serializeSSE(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Serialize a heartbeat comment (keeps connection alive).
 */
export function serializeHeartbeat(): string {
  return `: heartbeat ${Date.now()}\n\n`;
}
```

---

### A3.1.3 Stream ordering guarantees

Enforced by the Executor (A5), not the SSE layer. The SSE engine is a dumb pipe.

```
┌─────────────────────────────────────────────────────┐
│                  Stream Lifecycle                   │
├─────────────────────────────────────────────────────┤
│  [START]                                            │
│     │                                               │
│     ▼                                               │
│  ┌─────────┐                                        │
│  │  token  │ ──► (zero or more)                     │
│  └────┬────┘                                        │
│       │                                             │
│       ▼                                             │
│  ┌──────────┐                                       │
│  │ metadata │ ──► first_token (optional, once)      │
│  └────┬─────┘                                       │
│       │                                             │
│       ▼                                             │
│  ┌─────────┐                                        │
│  │  token  │ ──► (zero or more)                     │
│  └────┬────┘                                        │
│       │                                             │
│       ├────────────────────┐                        │
│       ▼                    ▼                        │
│  ┌──────────┐         ┌─────────┐                   │
│  │ metadata │         │  error  │ ──► (at most 1)   │
│  │completion│         └────┬────┘                   │
│  └────┬─────┘              │                        │
│       │                    │                        │
│       └────────┬───────────┘                        │
│                ▼                                    │
│           ┌────────┐                                │
│           │  done  │ ──► (exactly one, always last) │
│           └────────┘                                │
│                │                                    │
│                ▼                                    │
│             [END]                                   │
└─────────────────────────────────────────────────────┘
```

**Invariants (enforced by Executor A5):**
- `done` is ALWAYS emitted (even on error)
- `done` is ALWAYS last
- `error` is emitted at most once
- After `error`, only `done` can follow

---

## A3.2 SSE Response Helper

### A3.2.1 Create SSE response for Next.js App Router

```typescript
// src/lib/inference/sse/response.ts

/**
 * Create an SSE response for Next.js App Router.
 */
export function createSSEResponse(
  stream: ReadableStream<Uint8Array>
): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
```

---

### A3.2.2 Create SSE encoder stream

```typescript
// src/lib/inference/sse/encoder.ts
import type { StreamEvent } from "../types";
import { serializeSSE } from "./serialize";

/**
 * Create a TransformStream that encodes StreamEvents to SSE format.
 */
export function createSSEEncoderStream(): TransformStream<StreamEvent, Uint8Array> {
  const encoder = new TextEncoder();

  return new TransformStream({
    transform(event, controller) {
      controller.enqueue(encoder.encode(serializeSSE(event)));
    },
  });
}
```

---

## A3.3 Stream Registry

### A3.3.1 Define stream registry interface

```typescript
// src/lib/inference/sse/registry.ts
import type { StreamEvent } from "../types";

export interface StreamRegistry {
  /**
   * Create a new stream for a request.
   * Returns a readable stream for the client.
   * @param onCancel - Optional callback when client disconnects
   */
  create(requestId: string, onCancel?: () => void): ReadableStream<StreamEvent>;

  /**
   * Publish an event to a stream.
   */
  publish(requestId: string, event: StreamEvent): void;

  /**
   * Close a stream (after done event).
   */
  close(requestId: string): void;

  /**
   * Check if a stream exists and is open.
   */
  has(requestId: string): boolean;

  /**
   * Get stream metadata (for debugging).
   */
  getMetadata(requestId: string): StreamMetadata | null;
}

export interface StreamMetadata {
  requestId: string;
  createdAt: number;
  eventCount: number;
  closed: boolean;
}
```

---

### A3.3.2 Implement in-memory stream registry with factory

Uses a factory function pattern for dependency injection and testability:

```typescript
// src/lib/inference/sse/registry.ts

interface ActiveStream {
  controller: ReadableStreamDefaultController<StreamEvent>;
  metadata: StreamMetadata;
  onCancel?: () => void;
}

export interface StreamRegistryOptions {
  /** TTL for stale streams in ms. Default: 5 minutes */
  ttlMs?: number;
  /** Cleanup interval in ms. Default: 1 minute */
  cleanupIntervalMs?: number;
}

/**
 * Create an in-memory stream registry.
 * Factory function allows multiple instances for testing.
 */
export function createStreamRegistry(
  options: StreamRegistryOptions = {}
): StreamRegistry {
  const { ttlMs = 5 * 60 * 1000, cleanupIntervalMs = 60 * 1000 } = options;

  const streams = new Map<string, ActiveStream>();
  let cleanupTimer: ReturnType<typeof setInterval> | null = null;

  function startCleanup(): void {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, stream] of streams) {
        if (stream.metadata.closed && now - stream.metadata.createdAt > ttlMs) {
          streams.delete(id);
        }
      }
    }, cleanupIntervalMs);
  }

  function stopCleanup(): void {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }

  // Start cleanup on creation
  startCleanup();

  const registry: StreamRegistry = {
    create(requestId: string, onCancel?: () => void): ReadableStream<StreamEvent> {
      if (streams.has(requestId)) {
        throw new Error(`Stream already exists for request ${requestId}`);
      }

      let streamController: ReadableStreamDefaultController<StreamEvent>;

      const stream = new ReadableStream<StreamEvent>({
        start(controller) {
          streamController = controller;
        },
        cancel() {
          // Client disconnected
          registry.close(requestId);
          onCancel?.();
        },
      });

      streams.set(requestId, {
        controller: streamController!,
        metadata: {
          requestId,
          createdAt: Date.now(),
          eventCount: 0,
          closed: false,
        },
        onCancel,
      });

      return stream;
    },

    publish(requestId: string, event: StreamEvent): void {
      const stream = streams.get(requestId);
      if (!stream || stream.metadata.closed) {
        return; // Silently ignore if stream doesn't exist or is closed
      }

      stream.controller.enqueue(event);
      stream.metadata.eventCount++;

      // Auto-close on done event
      if (event.type === "done") {
        registry.close(requestId);
      }
    },

    close(requestId: string): void {
      const stream = streams.get(requestId);
      if (!stream || stream.metadata.closed) return;

      stream.metadata.closed = true;
      try {
        stream.controller.close();
      } catch {
        // Controller may already be closed
      }
    },

    has(requestId: string): boolean {
      const stream = streams.get(requestId);
      return stream !== undefined && !stream.metadata.closed;
    },

    getMetadata(requestId: string): StreamMetadata | null {
      return streams.get(requestId)?.metadata ?? null;
    },
  };

  return registry;
}

/**
 * Default stream registry instance.
 * Use createStreamRegistry() directly for testing.
 */
export const streamRegistry = createStreamRegistry();
```

---

## A3.4 Stream Publisher

### A3.4.1 Create stream publisher factory

The publisher is a thin wrapper that publishes events to a registry. It has no business logic — ordering guarantees are enforced by the Executor (A5).

```typescript
// src/lib/inference/sse/publisher.ts
import type {
  TokenEvent,
  MetadataEvent,
  ErrorEvent,
  DoneEvent,
  ExecutionResult,
  ExecutionError,
  ExecutionMetrics
} from "../types";
import type { StreamRegistry } from "./registry";

export interface StreamPublisher {
  /** Emit a token event */
  emitToken(token: string): void;

  /** Emit a metadata event */
  emitMetadata(params: {
    kind: "first_token" | "completion";
    metrics?: Partial<ExecutionMetrics>;
  }): void;

  /** Emit an error event */
  emitError(error: ExecutionError): void;

  /** Emit done event (always last) */
  emitDone(result: ExecutionResult | null): void;
}

export interface CreateStreamPublisherParams {
  requestId: string;
  registry: StreamRegistry;
}

/**
 * Create a stream publisher for a specific request.
 */
export function createStreamPublisher({
  requestId,
  registry,
}: CreateStreamPublisherParams): StreamPublisher {
  return {
    emitToken(token: string): void {
      const event: TokenEvent = {
        type: "token",
        timestamp: Date.now(),
        data: { token },
      };
      registry.publish(requestId, event);
    },

    emitMetadata({ kind, metrics }): void {
      const event: MetadataEvent = {
        type: "metadata",
        timestamp: Date.now(),
        data: { kind, metrics },
      };
      registry.publish(requestId, event);
    },

    emitError(error: ExecutionError): void {
      const event: ErrorEvent = {
        type: "error",
        timestamp: Date.now(),
        data: { error },
      };
      registry.publish(requestId, event);
    },

    emitDone(result: ExecutionResult | null): void {
      const event: DoneEvent = {
        type: "done",
        timestamp: Date.now(),
        data: { result },
      };
      registry.publish(requestId, event);
    },
  };
}
```

**Design decision**: The publisher is deliberately simple — it just creates and publishes events. All ordering logic (emitting `first_token` metadata, ensuring `done` is always sent) belongs in the Executor (A5). This makes the SSE layer a pure transport concern.

---

## A3.5 Error Handling

### A3.5.1 Guarantee error → done ordering

Ordering guarantees are enforced by the Executor (A5), not the SSE layer:

```typescript
// In executor (A5), the pattern is:
const publisher = createStreamPublisher({ requestId, registry });

try {
  // Emit first_token metadata when TTFB is measured
  publisher.emitMetadata({ kind: "first_token", metrics: { ttfbMs } });

  // ... stream tokens
  for await (const token of adapter.generate(...)) {
    publisher.emitToken(token.data.token);
  }

  publisher.emitMetadata({ kind: "completion", metrics });
  publisher.emitDone(successResult);
} catch (error) {
  publisher.emitError(normalizedError);
  publisher.emitDone(failureResult);
}
```

---

### A3.5.2 Handle client disconnects

The registry calls the `onCancel` callback when the client disconnects:

```typescript
// In executor or gateway integration:
const stream = registry.create(requestId, () => {
  // Client disconnected — abort the execution
  abortController.abort();
});
```

The Executor receives cancellation via `ExecutionControls.signal` (from A2).

---

## A3.6 Integration with tRPC

### A3.6.1 API routing strategy

SSE streaming **cannot** be used in tRPC procedures — tRPC manages its own response serialization and doesn't support raw `Response` objects with custom headers.

**Strategy: tRPC for everything except streaming**

```
┌─────────────────────────────────────────────────────────────┐
│                      API Surface                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  /api/trpc/*              → tRPC Router                     │
│    ├── auth.*             → Authentication (Project C)      │
│    ├── models.*           → Model catalog (Project B)       │
│    ├── inference.history  → Request history                 │
│    └── inference.cancel   → Cancel request                  │
│                                                             │
│  /api/v1/infer            → Raw Route Handler (SSE)         │
│    └── POST               → Streaming inference endpoint    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### A3.6.2 SSE route handler pattern

The streaming endpoint uses a raw Next.js App Router route handler:

```typescript
// app/api/v1/infer/route.ts (NOT tRPC)
import { createSSEResponse, createSSEEncoderStream, streamRegistry } from "@/lib/inference/sse";
import { executeInference } from "@/lib/inference/executor";

export async function POST(request: Request): Promise<Response> {
  // 1. Parse and validate request (could use shared validation with tRPC)
  const body = await request.json();
  const requestId = crypto.randomUUID();

  // 2. Create abort controller for cancellation
  const abortController = new AbortController();

  // 3. Create stream for client (with cancel callback)
  const eventStream = streamRegistry.create(requestId, () => {
    abortController.abort();
  });

  // 4. Pipe through SSE encoder
  const encodedStream = eventStream.pipeThrough(createSSEEncoderStream());

  // 5. Start execution in background (fire-and-forget)
  // Execution publishes events to the stream via StreamPublisher
  executeInference({
    requestId,
    body,
    signal: abortController.signal,
  });

  // 6. Return SSE response immediately
  return createSSEResponse(encodedStream);
}
```

### A3.6.3 Shared validation

Request validation can be shared between tRPC and the raw route:

```typescript
// src/lib/inference/validation.ts
import { z } from "zod";

export const inferenceRequestSchema = z.object({
  messages: z.array(messageSchema),
  options: inferenceOptionsSchema.optional(),
  // ...
});

// Used in both:
// - tRPC procedures (for non-streaming operations)
// - Raw route handler (for streaming)
```

> **Note**: Full API design is owned by Project C (Gateway). This section documents how A3's SSE utilities integrate with the routing layer.

---

## A3.7 Module Exports

```typescript
// src/lib/inference/sse/index.ts

export { serializeSSE, serializeHeartbeat } from "./serialize";
export { createSSEResponse } from "./response";
export { createSSEEncoderStream } from "./encoder";
export {
  createStreamRegistry,
  streamRegistry,
  type StreamRegistry,
  type StreamMetadata,
} from "./registry";
export {
  createStreamPublisher,
  type StreamPublisher,
  type CreateStreamPublisherParams,
} from "./publisher";
```

---

## Tasks

### A3.1 SSE protocol

- [x] **A3.1.1 Create SSE serialization functions** (`serialize.ts`)
- [x] **A3.1.2 Document stream ordering guarantees** (in code comments)

### A3.2 SSE utilities

- [x] **A3.2.1 Create SSE response helper** (`response.ts`)
- [x] **A3.2.2 Create SSE encoder TransformStream** (`encoder.ts`)

### A3.3 Stream registry

- [x] **A3.3.1 Define StreamRegistry interface**
- [x] **A3.3.2 Implement createStreamRegistry factory**
- [x] **A3.3.3 Add TTL-based cleanup for stale streams**
- [x] **A3.3.4 Export default streamRegistry instance**

### A3.4 Publisher

- [x] **A3.4.1 Define StreamPublisher interface**
- [x] **A3.4.2 Implement createStreamPublisher factory**

### A3.5 Module organization

- [x] **A3.5.1 Create index.ts with all exports**

---

## A3.8 Unit Tests

**Directory**: `src/lib/inference/__tests__/sse/`

- [x] **A3.8.1 Test SSE serialization** (`serialize.test.ts`)
      - `serializeSSE` produces correct `event:` and `data:` format
      - `serializeSSE` handles all event types (token, metadata, error, done)
      - `serializeHeartbeat` produces valid SSE comment format
      - Output ends with double newline `\n\n`

- [x] **A3.8.2 Test stream registry** (`registry.test.ts`)
      - `create` returns ReadableStream
      - `create` throws if stream already exists for requestId
      - `create` calls onCancel when client disconnects
      - `publish` enqueues events to correct stream
      - `publish` silently ignores unknown requestId
      - `close` closes the stream controller
      - `close` is idempotent (can be called multiple times)
      - Stream auto-closes on `done` event
      - Events after close are ignored
      - `has` returns false for closed streams
      - `getMetadata` returns correct eventCount
      - Factory creates isolated instances (for parallel tests)

- [x] **A3.8.3 Test stream publisher** (`publisher.test.ts`)
      - `emitToken` publishes token event with correct structure
      - `emitMetadata` publishes metadata event with kind and metrics
      - `emitError` publishes error event
      - `emitDone` publishes done event
      - Publisher uses injected registry (not global)

---

## A3.9 UI Test Page

**Route**: `src/app/(test)/test/streaming/page.tsx`

Since SSE streaming behavior is best validated visually, create a test page:

- [x] **A3.9.1 Create streaming test page**
      - Button: "Start Mock Stream" - simulates token-by-token streaming
      - Button: "Start Stream with Error" - simulates error mid-stream
      - Button: "Cancel Stream" - tests client disconnect
      - Display: Token-by-token output with timestamps
      - Display: Event log showing all SSE events received
      - Display: Connection status indicator

- [x] **A3.9.2 Create mock streaming endpoint**
      - `src/app/(test)/api/test/stream/route.ts` - returns mock SSE stream
      - Configurable delay between tokens
      - Option to simulate error at token N
      - Uses createStreamPublisher and createStreamRegistry for isolation
