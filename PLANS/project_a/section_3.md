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
// data: {"type":"token","timestamp":1234567890,"data":{"token":"Hello","index":0}}
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

Enforced by the stream registry (A3.3):

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

**Invariants:**
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
import { serializeSSE, serializeHeartbeat } from "./serialize";

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
import type { StreamEvent, DoneEvent } from "../types";

export interface StreamRegistry {
  /**
   * Create a new stream for a request.
   * Returns a readable stream for the client.
   */
  create(requestId: string): ReadableStream<StreamEvent>;

  /**
   * Publish an event to a stream.
   * Only the executor should call this.
   */
  publish(requestId: string, event: StreamEvent): void;

  /**
   * Close a stream (after done event).
   */
  close(requestId: string): void;

  /**
   * Check if a stream exists.
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

### A3.3.2 Implement in-memory stream registry

```typescript
// src/lib/inference/sse/registry.ts

interface ActiveStream {
  controller: ReadableStreamDefaultController<StreamEvent>;
  metadata: StreamMetadata;
}

class InMemoryStreamRegistry implements StreamRegistry {
  private streams = new Map<string, ActiveStream>();
  private readonly ttlMs: number;

  constructor(ttlMs = 5 * 60 * 1000) { // 5 minute default TTL
    this.ttlMs = ttlMs;
    this.startCleanupInterval();
  }

  create(requestId: string): ReadableStream<StreamEvent> {
    if (this.streams.has(requestId)) {
      throw new Error(`Stream already exists for request ${requestId}`);
    }

    let controller: ReadableStreamDefaultController<StreamEvent>;

    const stream = new ReadableStream<StreamEvent>({
      start(c) {
        controller = c;
      },
      cancel: () => {
        this.close(requestId);
      },
    });

    this.streams.set(requestId, {
      controller: controller!,
      metadata: {
        requestId,
        createdAt: Date.now(),
        eventCount: 0,
        closed: false,
      },
    });

    return stream;
  }

  publish(requestId: string, event: StreamEvent): void {
    const stream = this.streams.get(requestId);
    if (!stream || stream.metadata.closed) {
      return; // Silently ignore if stream doesn't exist or is closed
    }

    stream.controller.enqueue(event);
    stream.metadata.eventCount++;

    // Auto-close on done event
    if (event.type === "done") {
      this.close(requestId);
    }
  }

  close(requestId: string): void {
    const stream = this.streams.get(requestId);
    if (!stream || stream.metadata.closed) return;

    stream.metadata.closed = true;
    stream.controller.close();
  }

  // ... has(), getMetadata(), cleanup interval
}

export const streamRegistry = new InMemoryStreamRegistry();
```

---

## A3.4 Executor Integration

### A3.4.1 Stream publisher interface

Used by the Executor (A5) to publish events:

```typescript
// src/lib/inference/sse/publisher.ts
import type {
  StreamEvent,
  TokenEvent,
  MetadataEvent,
  ErrorEvent,
  DoneEvent,
  ExecutionResult,
  ExecutionError,
  ExecutionMetrics
} from "../types";
import { streamRegistry } from "./registry";

export class StreamPublisher {
  private tokenIndex = 0;
  private firstTokenEmitted = false;

  constructor(private readonly requestId: string) {}

  /**
   * Emit a token event.
   */
  emitToken(token: string): void {
    const event: TokenEvent = {
      type: "token",
      timestamp: Date.now(),
      data: { token, index: this.tokenIndex++ },
    };

    // Emit first_token metadata on first token
    if (!this.firstTokenEmitted) {
      this.emitMetadata("first_token");
      this.firstTokenEmitted = true;
    }

    streamRegistry.publish(this.requestId, event);
  }

  /**
   * Emit metadata event.
   */
  emitMetadata(kind: "first_token" | "completion", metrics?: Partial<ExecutionMetrics>): void {
    const event: MetadataEvent = {
      type: "metadata",
      timestamp: Date.now(),
      data: { kind, metrics },
    };
    streamRegistry.publish(this.requestId, event);
  }

  /**
   * Emit error event.
   */
  emitError(error: ExecutionError): void {
    const event: ErrorEvent = {
      type: "error",
      timestamp: Date.now(),
      data: { error },
    };
    streamRegistry.publish(this.requestId, event);
  }

  /**
   * Emit done event (always last).
   */
  emitDone(result: ExecutionResult | null): void {
    const event: DoneEvent = {
      type: "done",
      timestamp: Date.now(),
      data: { result },
    };
    streamRegistry.publish(this.requestId, event);
  }
}
```

---

## A3.5 Error Handling

### A3.5.1 Guarantee error → done ordering

The `StreamPublisher` enforces that `emitDone()` is always called, even after errors:

```typescript
// In executor (A5), the pattern is:
try {
  // ... execute inference
  publisher.emitMetadata("completion", metrics);
  publisher.emitDone(successResult);
} catch (error) {
  publisher.emitError(normalizedError);
  publisher.emitDone(failureResult);
}
```

---

### A3.5.2 Handle client disconnects

```typescript
// The registry's cancel callback handles disconnects
const stream = new ReadableStream<StreamEvent>({
  // ...
  cancel: () => {
    // Client disconnected
    this.close(requestId);
    // Executor receives abort signal via ExecutionControls.signal
  },
});
```

---

## Tasks

### A3.1 SSE protocol

- [ ] **A3.1.1 Define SSE serialization functions**
- [ ] **A3.1.2 Document stream ordering guarantees**

### A3.2 SSE utilities

- [ ] **A3.2.1 Create SSE response helper for App Router**
- [ ] **A3.2.2 Create SSE encoder TransformStream**
- [ ] **A3.2.3 Add heartbeat support**

### A3.3 Stream registry

- [ ] **A3.3.1 Define StreamRegistry interface**
- [ ] **A3.3.2 Implement InMemoryStreamRegistry**
- [ ] **A3.3.3 Add TTL-based cleanup**
- [ ] **A3.3.4 Enforce single-writer semantics**

### A3.4 Publisher

- [ ] **A3.4.1 Create StreamPublisher class**
- [ ] **A3.4.2 Implement token emission with auto-indexing**
- [ ] **A3.4.3 Implement metadata emission**
- [ ] **A3.4.4 Implement error and done emission**

### A3.5 Error handling

- [ ] **A3.5.1 Guarantee error → done ordering**
- [ ] **A3.5.2 Handle client disconnect cleanup**

---

## A3.6 Unit Tests

**File**: `src/lib/inference/__tests__/sse/`

- [ ] **A3.6.1 Test SSE serialization** (`serialize.test.ts`)
      - `serializeSSE` produces correct `event:` and `data:` format
      - `serializeSSE` handles all event types (token, metadata, error, done)
      - `serializeHeartbeat` produces valid SSE comment format
      - Output ends with double newline `\n\n`

- [ ] **A3.6.2 Test stream registry** (`registry.test.ts`)
      - `create` returns ReadableStream
      - `create` throws if stream already exists for requestId
      - `publish` enqueues events to correct stream
      - `publish` silently ignores unknown requestId
      - `close` closes the stream controller
      - `close` is idempotent (can be called multiple times)
      - Stream auto-closes on `done` event
      - Events after close are ignored
      - `getMetadata` returns correct eventCount

- [ ] **A3.6.3 Test stream publisher** (`publisher.test.ts`)
      - `emitToken` increments token index automatically
      - `emitToken` emits `first_token` metadata on first token
      - `emitMetadata` emits with correct kind
      - `emitError` creates proper error event
      - `emitDone` always emits done event
      - Publisher is safe to use after stream closes

- [ ] **A3.6.4 Test ordering guarantees** (`ordering.test.ts`)
      - Done event is always last
      - Error followed by done is valid
      - Multiple tokens followed by done is valid
      - No events allowed after done

---

## A3.7 UI Test Page

**Route**: `app/(test)/test/streaming/page.tsx`

Since SSE streaming behavior is best validated visually, create a test page:

- [ ] **A3.7.1 Create streaming test page**
      - Button: "Start Mock Stream" - simulates token-by-token streaming
      - Button: "Start Stream with Error" - simulates error mid-stream
      - Button: "Cancel Stream" - tests client disconnect
      - Display: Token-by-token output with timestamps
      - Display: Event log showing all SSE events received
      - Display: Connection status indicator

- [ ] **A3.7.2 Create mock streaming endpoint**
      - `app/api/test/stream/route.ts` - returns mock SSE stream
      - Configurable delay between tokens
      - Option to simulate error at token N
      - Uses real StreamPublisher and SSE response helpers
