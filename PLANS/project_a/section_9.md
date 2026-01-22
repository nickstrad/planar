# A9 — Test Infrastructure & Scaffolding

> **Purpose**: Set up all testing configuration, utilities, mocks, and UI test pages needed to validate Project A components.

**Depends on**: All previous sections (A2-A8)

**File locations**:
- Config: `jest.config.js`, `src/lib/inference/__tests__/`
- Mocks: `src/lib/inference/__tests__/mocks/`
- UI Tests: `app/(test)/test/`

---

## A9.1 Jest Configuration

### A9.1.1 Configure Jest for inference tests

```javascript
// jest.config.js
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: [
    "/node_modules/",
    ".*\\.integration\\.test\\.ts$", // Exclude integration tests by default
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/src/lib/inference/__tests__/setup.ts"],
  collectCoverageFrom: [
    "src/lib/inference/**/*.ts",
    "!src/lib/inference/__tests__/**",
  ],
  coverageDirectory: "coverage",
};

module.exports = createJestConfig(customJestConfig);
```

---

### A9.1.2 Create test setup file

```typescript
// src/lib/inference/__tests__/setup.ts

// Mock server-only module for tests
jest.mock("server-only", () => ({}));

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test timeout (10 seconds)
jest.setTimeout(10_000);
```

---

### A9.1.3 Add npm scripts for testing

```json
// package.json scripts (add these)
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --testPathPattern='.*\\.integration\\.test\\.ts$'",
    "test:all": "jest --testPathIgnorePatterns=''"
  }
}
```

---

## A9.2 Mock Factories

### A9.2.1 Mock adapter factory

```typescript
// src/lib/inference/__tests__/mocks/adapter.ts
import type {
  ProviderAdapter,
  ProviderCapabilities,
  InferenceRequest,
  ResolvedProvider,
  TokenEvent,
  ErrorEvent,
  ExecutionMetrics,
  ExecutionError,
} from "../../types";

export interface MockAdapterOptions {
  providerId?: string;
  tokens?: string[];
  delayMs?: number;
  error?: ExecutionError;
  errorAtToken?: number; // Emit error after N tokens
  metrics?: Partial<ExecutionMetrics>;
}

export function createMockAdapter(options: MockAdapterOptions = {}): ProviderAdapter {
  const {
    providerId = "mock",
    tokens = ["Hello", " ", "World"],
    delayMs = 0,
    error,
    errorAtToken,
    metrics = {},
  } = options;

  return {
    providerId,
    capabilities: {
      supportsStreaming: true,
      maxContextLength: 4096,
      supportedModels: ["mock-model"],
      supportsTools: false,
    },

    async *generate(
      request: InferenceRequest,
      provider: ResolvedProvider,
      signal?: AbortSignal
    ): AsyncGenerator<TokenEvent | ErrorEvent, ExecutionMetrics, undefined> {
      const startTime = Date.now();
      let tokenIndex = 0;

      for (const token of tokens) {
        if (signal?.aborted) {
          yield {
            type: "error",
            timestamp: Date.now(),
            data: {
              error: {
                kind: "cancelled",
                message: "Request cancelled",
                providerId,
                retryable: false,
              },
            },
          };
          break;
        }

        if (errorAtToken !== undefined && tokenIndex === errorAtToken) {
          yield {
            type: "error",
            timestamp: Date.now(),
            data: { error: error! },
          };
          break;
        }

        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }

        yield {
          type: "token",
          timestamp: Date.now(),
          data: { token, index: tokenIndex++ },
        };
      }

      if (error && errorAtToken === undefined) {
        yield {
          type: "error",
          timestamp: Date.now(),
          data: { error },
        };
      }

      return {
        promptTokens: metrics.promptTokens ?? 10,
        completionTokens: metrics.completionTokens ?? tokens.length,
        ttfbMs: metrics.ttfbMs ?? 50,
        totalMs: metrics.totalMs ?? (Date.now() - startTime),
        retryCount: metrics.retryCount ?? 0,
      };
    },

    async healthCheck() {
      return true;
    },
  };
}

/**
 * Create adapter that always fails with specific error.
 */
export function createFailingAdapter(
  error: ExecutionError,
  providerId = "failing-mock"
): ProviderAdapter {
  return createMockAdapter({
    providerId,
    tokens: [],
    error,
  });
}

/**
 * Create adapter that times out (never resolves).
 */
export function createHangingAdapter(providerId = "hanging-mock"): ProviderAdapter {
  return {
    providerId,
    capabilities: {
      supportsStreaming: true,
      maxContextLength: 4096,
      supportedModels: ["hanging-model"],
      supportsTools: false,
    },
    async *generate() {
      // Never yields, never returns - simulates hang
      await new Promise(() => {});
      return { promptTokens: 0, completionTokens: 0, ttfbMs: 0, totalMs: 0, retryCount: 0 };
    },
    async healthCheck() {
      return true;
    },
  };
}
```

---

### A9.2.2 Mock persistence factory

```typescript
// src/lib/inference/__tests__/mocks/persistence.ts
import type { ExecutionPersistence } from "../../persistence/interface";
import type { ExecutionRecord, ExecutionAttempt } from "../../persistence/schema";
import type { ExecutionResult, ResolvedProvider } from "../../types";

/**
 * In-memory persistence for testing.
 */
export class InMemoryPersistence implements ExecutionPersistence {
  private records = new Map<string, ExecutionRecord>();
  private attempts = new Map<string, ExecutionAttempt>();

  async createRecord(requestId: string): Promise<ExecutionRecord> {
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

  async recordAttemptStart(
    requestId: string,
    provider: ResolvedProvider,
    attemptNumber: number,
    isFallback: boolean
  ): Promise<ExecutionAttempt> {
    const attempt: ExecutionAttempt = {
      id: `attempt-${requestId}-${attemptNumber}`,
      requestId,
      provider,
      attemptNumber,
      isFallback,
      startedAt: new Date(),
      completedAt: null,
      success: false,
      metrics: null,
      error: null,
    };

    this.attempts.set(attempt.id, attempt);

    const record = this.records.get(requestId);
    if (record) {
      record.attempts.push(attempt);
    }

    return attempt;
  }

  async recordAttemptCompletion(
    attemptId: string,
    result: ExecutionResult
  ): Promise<ExecutionAttempt> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) {
      throw new Error(`Attempt not found: ${attemptId}`);
    }

    attempt.completedAt = new Date();
    attempt.success = result.success;
    attempt.metrics = result.metrics;
    attempt.error = result.error;

    return attempt;
  }

  async recordFinalOutcome(
    requestId: string,
    result: ExecutionResult
  ): Promise<ExecutionRecord> {
    const record = this.records.get(requestId);
    if (!record) {
      throw new Error(`Record not found: ${requestId}`);
    }

    record.finalProvider = result.resolvedProvider;
    record.finalSuccess = result.success;
    record.finalMetrics = result.metrics;
    record.finalError = result.error;
    record.completedAt = new Date();

    return record;
  }

  async getRecord(requestId: string): Promise<ExecutionRecord | null> {
    return this.records.get(requestId) ?? null;
  }

  // Test helpers
  clear(): void {
    this.records.clear();
    this.attempts.clear();
  }

  getRecordCount(): number {
    return this.records.size;
  }

  getAttemptCount(): number {
    return this.attempts.size;
  }
}
```

---

### A9.2.3 Mock stream registry

```typescript
// src/lib/inference/__tests__/mocks/stream.ts
import type { StreamEvent } from "../../types";

/**
 * Collects events for testing instead of streaming.
 */
export class MockStreamCollector {
  private events: StreamEvent[] = [];
  private closed = false;

  publish(event: StreamEvent): void {
    if (this.closed) return;
    this.events.push(event);
    if (event.type === "done") {
      this.closed = true;
    }
  }

  getEvents(): StreamEvent[] {
    return [...this.events];
  }

  getTokens(): string[] {
    return this.events
      .filter((e) => e.type === "token")
      .map((e) => (e as any).data.token);
  }

  getFullResponse(): string {
    return this.getTokens().join("");
  }

  hasError(): boolean {
    return this.events.some((e) => e.type === "error");
  }

  getError(): any | null {
    const errorEvent = this.events.find((e) => e.type === "error");
    return errorEvent ? (errorEvent as any).data.error : null;
  }

  isDone(): boolean {
    return this.events.some((e) => e.type === "done");
  }

  clear(): void {
    this.events = [];
    this.closed = false;
  }
}
```

---

### A9.2.4 Test data factories

```typescript
// src/lib/inference/__tests__/mocks/data.ts
import type {
  InferenceRequest,
  ExecutionInput,
  RoutingPlan,
  ResolvedProvider,
  ExecutionControls,
  ExecutionError,
} from "../../types";

let requestCounter = 0;

export function createTestRequest(
  overrides: Partial<InferenceRequest> = {}
): InferenceRequest {
  return {
    requestId: `test-request-${++requestCounter}`,
    messages: [{ role: "user", content: "Hello" }],
    options: { stream: true },
    ...overrides,
  };
}

export function createTestProvider(
  overrides: Partial<ResolvedProvider> = {}
): ResolvedProvider {
  return {
    providerId: "mock",
    modelId: "mock-model",
    ...overrides,
  };
}

export function createTestRoutingPlan(
  overrides: Partial<RoutingPlan> = {}
): RoutingPlan {
  return {
    primary: createTestProvider(),
    fallbacks: [],
    snapshot: {
      resolvedAt: new Date(),
      strategy: "test",
      originalAlias: "test-alias",
    },
    ...overrides,
  };
}

export function createTestControls(
  overrides: Partial<ExecutionControls> = {}
): ExecutionControls {
  return {
    timeoutMs: 60_000,
    maxRetries: 1,
    ...overrides,
  };
}

export function createTestExecutionInput(
  overrides: Partial<ExecutionInput> = {}
): ExecutionInput {
  return {
    request: createTestRequest(),
    routingPlan: createTestRoutingPlan(),
    controls: createTestControls(),
    ...overrides,
  };
}

export function createTestError(
  kind: ExecutionError["kind"] = "provider_error",
  overrides: Partial<ExecutionError> = {}
): ExecutionError {
  return {
    kind,
    message: `Test ${kind} error`,
    providerId: "mock",
    retryable: ["rate_limit", "network_error", "timeout"].includes(kind),
    ...overrides,
  };
}
```

---

## A9.3 Test Utilities

### A9.3.1 Async test helpers

```typescript
// src/lib/inference/__tests__/utils/async.ts

/**
 * Wait for a condition to be true.
 */
export async function waitFor(
  condition: () => boolean,
  timeoutMs = 5000,
  intervalMs = 50
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor timeout");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * Collect all values from an async generator.
 */
export async function collectGenerator<T, R>(
  generator: AsyncGenerator<T, R, undefined>
): Promise<{ values: T[]; result: R }> {
  const values: T[] = [];
  let iterResult = await generator.next();
  while (!iterResult.done) {
    values.push(iterResult.value);
    iterResult = await generator.next();
  }
  return { values, result: iterResult.value };
}

/**
 * Create an AbortController that aborts after delay.
 */
export function createDelayedAbort(delayMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), delayMs);
  return controller;
}
```

---

### A9.3.2 Index file for mocks

```typescript
// src/lib/inference/__tests__/mocks/index.ts
export * from "./adapter";
export * from "./persistence";
export * from "./stream";
export * from "./data";
```

---

## A9.4 UI Test Pages Setup

### A9.4.1 Create test route group layout

```typescript
// app/(test)/layout.tsx
import type { ReactNode } from "react";

export default function TestLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-amber-500">TEST MODE</span>
          <a href="/test" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← All Tests
          </a>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
```

---

### A9.4.2 Create test index page

```typescript
// app/(test)/test/page.tsx
import Link from "next/link";

const testPages = [
  {
    href: "/test/streaming",
    title: "SSE Streaming",
    description: "Test token streaming, event ordering, and client disconnect handling",
    section: "A3",
  },
  {
    href: "/test/adapters",
    title: "Provider Adapters",
    description: "Test real provider connections and health checks",
    section: "A4",
  },
  {
    href: "/test/executor",
    title: "Inference Executor",
    description: "Test full execution flow with retry, fallback, and cancellation",
    section: "A5",
  },
];

export default function TestIndexPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Project A Test Pages</h1>
      <p className="text-zinc-400 mb-8">
        Visual test pages for validating inference system behavior.
      </p>

      <div className="space-y-4">
        {testPages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="block p-4 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-amber-500">{page.section}</span>
              <h2 className="font-semibold">{page.title}</h2>
            </div>
            <p className="text-sm text-zinc-400">{page.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

---

### A9.4.3 Shared test page components

```typescript
// app/(test)/test/_components/TestPanel.tsx
import type { ReactNode } from "react";

interface TestPanelProps {
  title: string;
  children: ReactNode;
}

export function TestPanel({ title, children }: TestPanelProps) {
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
```

```typescript
// app/(test)/test/_components/EventLog.tsx
"use client";

import { useState } from "react";

interface Event {
  type: string;
  timestamp: number;
  data?: unknown;
}

interface EventLogProps {
  events: Event[];
  maxHeight?: string;
}

export function EventLog({ events, maxHeight = "300px" }: EventLogProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div
      className="font-mono text-xs space-y-1 overflow-auto"
      style={{ maxHeight }}
    >
      {events.length === 0 && (
        <div className="text-zinc-500 italic">No events yet</div>
      )}
      {events.map((event, i) => (
        <div
          key={i}
          className="flex gap-2 cursor-pointer hover:bg-zinc-900 p-1 rounded"
          onClick={() => setExpanded(expanded === i ? null : i)}
        >
          <span className="text-zinc-500 w-20 shrink-0">
            {new Date(event.timestamp).toISOString().slice(11, 23)}
          </span>
          <span
            className={`w-16 shrink-0 ${
              event.type === "error"
                ? "text-red-400"
                : event.type === "done"
                  ? "text-green-400"
                  : "text-blue-400"
            }`}
          >
            {event.type}
          </span>
          {expanded === i && event.data && (
            <pre className="text-zinc-400 whitespace-pre-wrap">
              {JSON.stringify(event.data, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
```

```typescript
// app/(test)/test/_components/index.ts
export { TestPanel } from "./TestPanel";
export { EventLog } from "./EventLog";
```

---

## Tasks

### A9.1 Jest configuration

- [ ] **A9.1.1 Install Jest dependencies** (if not already installed via Next.js)
      ```bash
      npm install -D jest @types/jest ts-jest
      ```

- [ ] **A9.1.2 Create jest.config.js**

- [ ] **A9.1.3 Create test setup file** (`src/lib/inference/__tests__/setup.ts`)

- [ ] **A9.1.4 Add npm test scripts to package.json**

### A9.2 Mock factories

- [ ] **A9.2.1 Create mock adapter factory** (`__tests__/mocks/adapter.ts`)
      - `createMockAdapter` with configurable tokens, delay, errors
      - `createFailingAdapter` for error scenarios
      - `createHangingAdapter` for timeout testing

- [ ] **A9.2.2 Create in-memory persistence** (`__tests__/mocks/persistence.ts`)
      - Implements `ExecutionPersistence` interface
      - Test helpers: `clear()`, `getRecordCount()`

- [ ] **A9.2.3 Create mock stream collector** (`__tests__/mocks/stream.ts`)
      - Collects events instead of streaming
      - Helpers: `getTokens()`, `getFullResponse()`, `hasError()`

- [ ] **A9.2.4 Create test data factories** (`__tests__/mocks/data.ts`)
      - `createTestRequest`, `createTestProvider`
      - `createTestRoutingPlan`, `createTestControls`
      - `createTestExecutionInput`, `createTestError`

- [ ] **A9.2.5 Create mocks index file** (`__tests__/mocks/index.ts`)

### A9.3 Test utilities

- [ ] **A9.3.1 Create async test helpers** (`__tests__/utils/async.ts`)
      - `waitFor` - wait for condition
      - `collectGenerator` - collect async generator values
      - `createDelayedAbort` - AbortController with delay

### A9.4 UI test pages

- [ ] **A9.4.1 Create test route group layout** (`app/(test)/layout.tsx`)

- [ ] **A9.4.2 Create test index page** (`app/(test)/test/page.tsx`)

- [ ] **A9.4.3 Create shared test components**
      - `TestPanel` - consistent panel styling
      - `EventLog` - display SSE events with timestamps

- [ ] **A9.4.4 Create streaming test page** (`app/(test)/test/streaming/page.tsx`)
      - See A3.7 for specifications

- [ ] **A9.4.5 Create adapters test page** (`app/(test)/test/adapters/page.tsx`)
      - See A4.8 for specifications

- [ ] **A9.4.6 Create executor test page** (`app/(test)/test/executor/page.tsx`)
      - See A5.6 for specifications

### A9.5 Test API endpoints

- [ ] **A9.5.1 Create mock stream endpoint** (`app/api/test/stream/route.ts`)
      - Returns configurable mock SSE stream
      - Supports delay, error injection

- [ ] **A9.5.2 Create adapter test endpoint** (`app/api/test/adapter/route.ts`)
      - Direct adapter testing
      - Bypasses executor

- [ ] **A9.5.3 Create executor test endpoint** (`app/api/test/execute/route.ts`)
      - Full execution flow
      - Supports cancellation
