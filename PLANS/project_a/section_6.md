# A6 — Persistence (Execution State Only)

> **Purpose**: Persist execution-level telemetry for debugging, replay, and observability. Request lifecycle and tenant data are owned by Project C.

**Depends on**: A2 (Types) — uses `ExecutionResult`, `ExecutionMetrics`, `ExecutionError`, `ResolvedProvider`

**File location**: `src/lib/inference/persistence/`

---

## A6.1 Execution State Schema

### A6.1.1 Define execution record schema

```typescript
// src/lib/inference/persistence/schema.ts
import type {
  ExecutionMetrics,
  ExecutionError,
  ResolvedProvider,
} from "../types";

/**
 * Execution attempt record — one per provider attempt.
 * Multiple attempts may exist for a single request (retries/fallbacks).
 */
export interface ExecutionAttempt {
  /** Auto-generated attempt ID */
  id: string;

  /** Request ID from Project C */
  requestId: string;

  /** Provider used for this attempt */
  provider: ResolvedProvider;

  /** Attempt number (0 for first, increments on retry/fallback) */
  attemptNumber: number;

  /** Whether this was a fallback attempt */
  isFallback: boolean;

  /** Attempt lifecycle */
  startedAt: Date;
  completedAt: Date | null;

  /** Outcome */
  success: boolean;
  metrics: ExecutionMetrics | null;
  error: ExecutionError | null;
}

/**
 * Execution record — aggregates all attempts for a request.
 * This is what gets persisted for debugging/replay.
 */
export interface ExecutionRecord {
  /** Request ID (primary key, from Project C) */
  requestId: string;

  /** All attempts (ordered by attemptNumber) */
  attempts: ExecutionAttempt[];

  /** Final outcome */
  finalProvider: ResolvedProvider | null;
  finalSuccess: boolean;
  finalMetrics: ExecutionMetrics | null;
  finalError: ExecutionError | null;

  /** Lifecycle timestamps */
  createdAt: Date;
  completedAt: Date | null;
}
```

---

### A6.1.2 Execution persistence interface

```typescript
// src/lib/inference/persistence/interface.ts
import type { ExecutionAttempt, ExecutionRecord } from "./schema";
import type { ExecutionResult, ResolvedProvider } from "../types";

/**
 * Persistence interface for execution state.
 * Implemented by database adapter (Prisma).
 */
export interface ExecutionPersistence {
  /**
   * Create a new execution record when request starts.
   */
  createRecord(requestId: string): Promise<ExecutionRecord>;

  /**
   * Record attempt start.
   */
  recordAttemptStart(
    requestId: string,
    provider: ResolvedProvider,
    attemptNumber: number,
    isFallback: boolean
  ): Promise<ExecutionAttempt>;

  /**
   * Record attempt completion.
   */
  recordAttemptCompletion(
    attemptId: string,
    result: ExecutionResult
  ): Promise<ExecutionAttempt>;

  /**
   * Record final execution outcome.
   */
  recordFinalOutcome(
    requestId: string,
    result: ExecutionResult
  ): Promise<ExecutionRecord>;

  /**
   * Get execution record for debugging/replay.
   */
  getRecord(requestId: string): Promise<ExecutionRecord | null>;
}
```

---

## A6.2 Write Path Rules

### A6.2.1 Async persistence wrapper

Persistence should not block the hot path. Use fire-and-forget with error logging.

```typescript
// src/lib/inference/persistence/async.ts
import type { ExecutionPersistence } from "./interface";
import type { ExecutionResult, ResolvedProvider } from "../types";

/**
 * Async wrapper that doesn't block execution on persistence.
 * Logs errors but doesn't propagate them.
 */
export class AsyncExecutionPersistence {
  constructor(
    private readonly persistence: ExecutionPersistence,
    private readonly logger: (error: Error, context: string) => void
  ) {}

  /**
   * Fire-and-forget: create record.
   */
  createRecord(requestId: string): void {
    this.persistence.createRecord(requestId).catch((error) => {
      this.logger(error, `createRecord:${requestId}`);
    });
  }

  /**
   * Fire-and-forget: record attempt start.
   */
  recordAttemptStart(
    requestId: string,
    provider: ResolvedProvider,
    attemptNumber: number,
    isFallback: boolean
  ): void {
    this.persistence
      .recordAttemptStart(requestId, provider, attemptNumber, isFallback)
      .catch((error) => {
        this.logger(error, `recordAttemptStart:${requestId}:${attemptNumber}`);
      });
  }

  /**
   * Awaited: record final outcome (terminal state must persist).
   */
  async recordFinalOutcome(
    requestId: string,
    result: ExecutionResult
  ): Promise<void> {
    try {
      await this.persistence.recordFinalOutcome(requestId, result);
    } catch (error) {
      this.logger(error as Error, `recordFinalOutcome:${requestId}`);
      // Still don't throw — execution succeeded even if persistence failed
    }
  }
}
```

---

### A6.2.2 Integration with Executor

The executor (A5) uses persistence at key lifecycle points:

```typescript
// In executor/index.ts — persistence integration points:

// 1. On execution start
persistence.createRecord(request.requestId);

// 2. On each provider attempt start
persistence.recordAttemptStart(
  request.requestId,
  provider,
  fallbackCount,
  fallbackCount > 0
);

// 3. On final completion (awaited for terminal reliability)
await persistence.recordFinalOutcome(request.requestId, result);
```

---

## A6.3 Execution Replay Support

### A6.3.1 Store execution input snapshot

For debugging, store what was sent to the provider:

```typescript
// src/lib/inference/persistence/replay.ts
import type { InferenceRequest, ResolvedProvider } from "../types";

/**
 * Snapshot of execution input for replay/debugging.
 */
export interface ExecutionInputSnapshot {
  requestId: string;

  /** Original request (messages, options) */
  request: {
    messages: InferenceRequest["messages"];
    options: InferenceRequest["options"];
  };

  /** Provider that was used */
  provider: {
    providerId: string;
    modelId: string;
  };

  /** When snapshot was captured */
  capturedAt: Date;
}

/**
 * Capture input snapshot before execution.
 */
export function captureInputSnapshot(
  request: InferenceRequest,
  provider: ResolvedProvider
): ExecutionInputSnapshot {
  return {
    requestId: request.requestId,
    request: {
      messages: request.messages,
      options: request.options,
    },
    provider: {
      providerId: provider.providerId,
      modelId: provider.modelId,
    },
    capturedAt: new Date(),
  };
}
```

---

### A6.3.2 Store execution output

Capture the final response for replay:

```typescript
// src/lib/inference/persistence/replay.ts (continued)

/**
 * Snapshot of execution output for replay.
 */
export interface ExecutionOutputSnapshot {
  requestId: string;

  /** Concatenated tokens from stream */
  fullResponse: string;

  /** Final metrics */
  metrics: {
    promptTokens: number;
    completionTokens: number;
    totalMs: number;
  };

  /** When snapshot was captured */
  capturedAt: Date;
}
```

---

## A6.4 Prisma Schema

> **Note**: This is the ONLY database schema change required for Project A.
> The `requestId` references requests created by Project C, but we don't add a
> foreign key constraint here since Project C hasn't implemented its schema yet.
> The relationship will be established when Project C adds its InferenceRequest table.

```prisma
// prisma/schema.prisma — execution tables (ADD TO EXISTING FILE)

model ExecutionRecord {
  id          String   @id @default(cuid())
  requestId   String   @unique

  // Final outcome
  success     Boolean?
  providerId  String?
  modelId     String?

  // Metrics
  promptTokens      Int?
  completionTokens  Int?
  ttfbMs            Int?
  totalMs           Int?

  // Error (if failed)
  errorKind    String?
  errorMessage String?

  // Lifecycle
  createdAt   DateTime  @default(now())
  completedAt DateTime?

  // Relations
  attempts    ExecutionAttempt[]

  @@index([requestId])
  @@index([createdAt])
  @@map("execution_record")
}

model ExecutionAttempt {
  id            String   @id @default(cuid())
  requestId     String
  attemptNumber Int

  // Provider
  providerId    String
  modelId       String

  // Outcome
  success       Boolean?
  isFallback    Boolean  @default(false)

  // Metrics
  promptTokens      Int?
  completionTokens  Int?
  ttfbMs            Int?
  totalMs           Int?

  // Error
  errorKind    String?
  errorMessage String?

  // Lifecycle
  startedAt    DateTime @default(now())
  completedAt  DateTime?

  // Relations
  record       ExecutionRecord @relation(fields: [requestId], references: [requestId], onDelete: Cascade)

  @@index([requestId])
  @@index([providerId])
  @@map("execution_attempt")
}
```

---

## Tasks

### A6.1 Execution state

- [ ] **A6.1.1 Define ExecutionAttempt and ExecutionRecord TypeScript interfaces**
- [ ] **A6.1.2 Define ExecutionPersistence interface**
- [ ] **A6.1.3 Implement Prisma-based persistence adapter**

### A6.2 Write path rules

- [ ] **A6.2.1 Implement AsyncExecutionPersistence wrapper**
- [ ] **A6.2.2 Integrate persistence with Executor**
- [ ] **A6.2.3 Handle write failures gracefully (log, don't fail)**

### A6.3 Replay support

- [ ] **A6.3.1 Implement ExecutionInputSnapshot capture**
- [ ] **A6.3.2 Implement ExecutionOutputSnapshot capture**
- [ ] **A6.3.3 Add replay retrieval endpoint (for debugging)**

### A6.4 Database schema

- [ ] **A6.4.1 Add Prisma models to schema.prisma**
- [ ] **A6.4.2 Run migration: `npx prisma migrate dev --name add_execution_tables`**
- [ ] **A6.4.3 Generate Prisma client**

---

## A6.5 Unit Tests

**File**: `src/lib/inference/__tests__/persistence/`

- [ ] **A6.5.1 Test in-memory persistence** (`inmemory.test.ts`)
      - Create in-memory implementation for testing
      - `createRecord` creates record with correct requestId
      - `recordAttemptStart` adds attempt to record
      - `recordFinalOutcome` updates record with final state
      - `getRecord` returns null for unknown requestId

- [ ] **A6.5.2 Test async wrapper** (`async.test.ts`)
      - `createRecord` is fire-and-forget (doesn't await)
      - `recordAttemptStart` is fire-and-forget
      - `recordFinalOutcome` IS awaited (terminal state)
      - Write failures are logged but don't throw
      - Logger receives error and context string

- [ ] **A6.5.3 Test snapshot capture** (`snapshot.test.ts`)
      - `captureInputSnapshot` captures messages and options
      - `captureInputSnapshot` captures provider info
      - Snapshot includes timestamp

---

## A6.6 Integration Tests (Requires Database)

**File**: `src/lib/inference/__tests__/persistence/integration/`

- [ ] **A6.6.1 Test Prisma persistence** (`prisma.integration.test.ts`)
      - Skip if DATABASE_URL not set
      - Creates ExecutionRecord in database
      - Creates ExecutionAttempt linked to record
      - Updates record on completion
      - Query by requestId works
      - Cascade delete removes attempts when record deleted
