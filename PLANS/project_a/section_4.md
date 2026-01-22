# A4 — Provider Adapters

> **Purpose**: Normalize wildly different inference backends into one unified execution interface.

**Depends on**: A2 (Types) — implements `ProviderAdapter`, uses `TokenEvent`, `ExecutionError`, `InferenceRequest`

**File location**: `src/lib/inference/adapters/`

---

## A4.1 Adapter Contract

### A4.1.1 Implement the ProviderAdapter interface

All adapters implement the interface defined in A2:

```typescript
// From A2 - src/lib/inference/types.ts
export interface ProviderAdapter {
  readonly providerId: string;
  readonly capabilities: ProviderCapabilities;

  generate(
    request: InferenceRequest,
    provider: ResolvedProvider,
    signal?: AbortSignal
  ): AsyncGenerator<TokenEvent | ErrorEvent, ExecutionMetrics, undefined>;

  healthCheck(): Promise<boolean>;
}
```

---

### A4.1.2 Base adapter class

Shared logic for all adapters:

```typescript
// src/lib/inference/adapters/base.ts
import type {
  ProviderAdapter,
  ProviderCapabilities,
  InferenceRequest,
  ResolvedProvider,
  TokenEvent,
  ErrorEvent,
  ExecutionMetrics,
  ExecutionError,
  ErrorKind,
} from "../types";
import { createExecutionError } from "../types";

export abstract class BaseAdapter implements ProviderAdapter {
  abstract readonly providerId: string;
  abstract readonly capabilities: ProviderCapabilities;

  abstract generate(
    request: InferenceRequest,
    provider: ResolvedProvider,
    signal?: AbortSignal
  ): AsyncGenerator<TokenEvent | ErrorEvent, ExecutionMetrics, undefined>;

  abstract healthCheck(): Promise<boolean>;

  /**
   * Create a token event with timestamp.
   */
  protected createTokenEvent(token: string, index: number): TokenEvent {
    return {
      type: "token",
      timestamp: Date.now(),
      data: { token, index },
    };
  }

  /**
   * Create an error event from a provider error.
   */
  protected createErrorEvent(
    kind: ErrorKind,
    message: string,
    providerError?: ExecutionError["providerError"]
  ): ErrorEvent {
    return {
      type: "error",
      timestamp: Date.now(),
      data: {
        error: createExecutionError(kind, message, this.providerId, providerError),
      },
    };
  }

  /**
   * Map HTTP status to error kind.
   */
  protected mapHttpStatusToErrorKind(status: number): ErrorKind {
    switch (status) {
      case 401:
      case 403:
        return "auth_error";
      case 429:
        return "rate_limit";
      case 404:
        return "model_not_found";
      case 400:
        return "context_length"; // Often indicates input too long
      default:
        return status >= 500 ? "provider_error" : "internal_error";
    }
  }
}
```

---

## A4.2 OpenAI Adapter

### A4.2.1 Implement OpenAI adapter

```typescript
// src/lib/inference/adapters/openai.ts
import OpenAI from "openai";
import type {
  InferenceRequest,
  ResolvedProvider,
  TokenEvent,
  ErrorEvent,
  ExecutionMetrics,
  ProviderCapabilities,
} from "../types";
import { BaseAdapter } from "./base";

export class OpenAIAdapter extends BaseAdapter {
  readonly providerId = "openai";
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    maxContextLength: 128000, // GPT-4o
    supportedModels: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    supportsTools: true,
  };

  private client: OpenAI;

  constructor(apiKey: string) {
    super();
    this.client = new OpenAI({ apiKey });
  }

  async *generate(
    request: InferenceRequest,
    provider: ResolvedProvider,
    signal?: AbortSignal
  ): AsyncGenerator<TokenEvent | ErrorEvent, ExecutionMetrics, undefined> {
    const startTime = Date.now();
    let tokenIndex = 0;
    let completionTokens = 0;
    let ttfbMs = 0;

    try {
      const stream = await this.client.chat.completions.create(
        {
          model: provider.modelId,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: request.options.maxTokens,
          temperature: request.options.temperature,
          stop: request.options.stopSequences,
          stream: true,
        },
        { signal }
      );

      for await (const chunk of stream) {
        // Record TTFB on first chunk
        if (tokenIndex === 0) {
          ttfbMs = Date.now() - startTime;
        }

        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield this.createTokenEvent(content, tokenIndex++);
          completionTokens++;
        }
      }

      return {
        promptTokens: 0, // OpenAI doesn't provide this in streaming
        completionTokens,
        ttfbMs,
        totalMs: Date.now() - startTime,
        retryCount: 0,
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        yield this.createErrorEvent(
          this.mapHttpStatusToErrorKind(error.status ?? 500),
          error.message,
          { code: error.code ?? undefined, status: error.status, message: error.message }
        );
      } else if (signal?.aborted) {
        yield this.createErrorEvent("cancelled", "Request was cancelled");
      } else {
        yield this.createErrorEvent("provider_error", String(error));
      }

      return {
        promptTokens: 0,
        completionTokens,
        ttfbMs,
        totalMs: Date.now() - startTime,
        retryCount: 0,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## A4.3 Ollama Adapter

### A4.3.1 Implement Ollama adapter

```typescript
// src/lib/inference/adapters/ollama.ts
import type {
  InferenceRequest,
  ResolvedProvider,
  TokenEvent,
  ErrorEvent,
  ExecutionMetrics,
  ProviderCapabilities,
} from "../types";
import { BaseAdapter } from "./base";

interface OllamaStreamChunk {
  model: string;
  response: string;
  done: boolean;
}

export class OllamaAdapter extends BaseAdapter {
  readonly providerId = "ollama";
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    maxContextLength: 8192, // Varies by model
    supportedModels: [], // Discovered dynamically
    supportsTools: false,
  };

  constructor(private readonly baseUrl: string = "http://localhost:11434") {}

  async *generate(
    request: InferenceRequest,
    provider: ResolvedProvider,
    signal?: AbortSignal
  ): AsyncGenerator<TokenEvent | ErrorEvent, ExecutionMetrics, undefined> {
    const startTime = Date.now();
    let tokenIndex = 0;
    let completionTokens = 0;
    let ttfbMs = 0;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: provider.modelId,
          prompt: this.formatPrompt(request.messages),
          stream: true,
          options: {
            num_predict: request.options.maxTokens,
            temperature: request.options.temperature,
            stop: request.options.stopSequences,
          },
        }),
        signal,
      });

      if (!response.ok) {
        yield this.createErrorEvent(
          this.mapHttpStatusToErrorKind(response.status),
          `Ollama error: ${response.statusText}`,
          { status: response.status, message: response.statusText }
        );
        return this.emptyMetrics(startTime);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield this.createErrorEvent("provider_error", "No response body");
        return this.emptyMetrics(startTime);
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const chunk: OllamaStreamChunk = JSON.parse(line);

          if (tokenIndex === 0) {
            ttfbMs = Date.now() - startTime;
          }

          if (chunk.response) {
            yield this.createTokenEvent(chunk.response, tokenIndex++);
            completionTokens++;
          }
        }
      }

      return {
        promptTokens: 0,
        completionTokens,
        ttfbMs,
        totalMs: Date.now() - startTime,
        retryCount: 0,
      };
    } catch (error) {
      if (signal?.aborted) {
        yield this.createErrorEvent("cancelled", "Request was cancelled");
      } else if (error instanceof TypeError && String(error).includes("fetch")) {
        yield this.createErrorEvent("network_error", "Failed to connect to Ollama");
      } else {
        yield this.createErrorEvent("provider_error", String(error));
      }
      return this.emptyMetrics(startTime);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private formatPrompt(messages: InferenceRequest["messages"]): string {
    // Simple format - Ollama handles system prompts differently per model
    return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  }

  private emptyMetrics(startTime: number): ExecutionMetrics {
    return {
      promptTokens: 0,
      completionTokens: 0,
      ttfbMs: 0,
      totalMs: Date.now() - startTime,
      retryCount: 0,
    };
  }
}
```

---

## A4.4 Provider Registry

### A4.4.1 Centralize provider registration

```typescript
// src/lib/inference/adapters/registry.ts
import type { ProviderAdapter, ProviderCapabilities } from "../types";
import { OpenAIAdapter } from "./openai";
import { OllamaAdapter } from "./ollama";
import { env } from "@/lib/env/server";

class ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  get(providerId: string): ProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  getCapabilities(providerId: string): ProviderCapabilities | undefined {
    return this.adapters.get(providerId)?.capabilities;
  }

  list(): string[] {
    return Array.from(this.adapters.keys());
  }

  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    for (const [id, adapter] of this.adapters) {
      results.set(id, await adapter.healthCheck());
    }
    return results;
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry();

// Register providers based on available configuration
export function initializeProviders(): void {
  // OpenAI - requires API key
  if (env.OPENAI_API_KEY) {
    providerRegistry.register(new OpenAIAdapter(env.OPENAI_API_KEY));
  }

  // Ollama - optional, defaults to localhost
  if (env.OLLAMA_BASE_URL) {
    providerRegistry.register(new OllamaAdapter(env.OLLAMA_BASE_URL));
  } else {
    // Register with default localhost URL
    providerRegistry.register(new OllamaAdapter());
  }
}
```

---

## A4.5 Telemetry Emission

### A4.5.1 Emit telemetry from adapters

Adapters emit telemetry events for Project D:

```typescript
// src/lib/inference/adapters/telemetry.ts
import type { TelemetryEvent, ExecutionMetrics, ExecutionError } from "../types";

type TelemetryEmitter = (event: TelemetryEvent) => void;

let emitter: TelemetryEmitter = () => {}; // No-op default

export function setTelemetryEmitter(fn: TelemetryEmitter): void {
  emitter = fn;
}

export function emitExecutionStarted(
  requestId: string,
  providerId: string,
  modelId: string
): void {
  emitter({
    type: "execution_started",
    requestId,
    providerId,
    modelId,
    timestamp: Date.now(),
  });
}

export function emitExecutionCompleted(
  requestId: string,
  providerId: string,
  modelId: string,
  metrics: ExecutionMetrics
): void {
  emitter({
    type: "execution_completed",
    requestId,
    providerId,
    modelId,
    timestamp: Date.now(),
    metrics,
  });
}

export function emitExecutionFailed(
  requestId: string,
  providerId: string,
  modelId: string,
  error: ExecutionError,
  metrics?: ExecutionMetrics
): void {
  emitter({
    type: "execution_failed",
    requestId,
    providerId,
    modelId,
    timestamp: Date.now(),
    metrics,
    error: { kind: error.kind, message: error.message },
  });
}
```

---

## Tasks

### A4.1 Adapter contract

- [ ] **A4.1.1 Create BaseAdapter abstract class**
- [ ] **A4.1.2 Implement token event creation helper**
- [ ] **A4.1.3 Implement error mapping helper**

### A4.2 OpenAI adapter

- [ ] **A4.2.1 Implement OpenAIAdapter class**
- [ ] **A4.2.2 Handle streaming responses**
- [ ] **A4.2.3 Map OpenAI errors to ErrorKind**
- [ ] **A4.2.4 Implement health check**

### A4.3 Ollama adapter

- [ ] **A4.3.1 Implement OllamaAdapter class**
- [ ] **A4.3.2 Handle NDJSON streaming**
- [ ] **A4.3.3 Map Ollama errors to ErrorKind**
- [ ] **A4.3.4 Implement health check**

### A4.4 Provider registry

- [ ] **A4.4.1 Create ProviderRegistry class**
- [ ] **A4.4.2 Implement provider initialization**
- [ ] **A4.4.3 Implement capability lookup**
- [ ] **A4.4.4 Implement health check aggregation**

### A4.5 Telemetry

- [ ] **A4.5.1 Create telemetry emission functions**
- [ ] **A4.5.2 Wire telemetry to adapters**

---

## A4.6 Unit Tests

**File**: `src/lib/inference/__tests__/adapters/`

- [ ] **A4.6.1 Test BaseAdapter helpers** (`base.test.ts`)
      - `createTokenEvent` produces correct event shape with timestamp
      - `createErrorEvent` produces error with correct providerId
      - `mapHttpStatusToErrorKind` maps 401/403 to auth_error
      - `mapHttpStatusToErrorKind` maps 429 to rate_limit
      - `mapHttpStatusToErrorKind` maps 404 to model_not_found
      - `mapHttpStatusToErrorKind` maps 5xx to provider_error
      - `mapHttpStatusToErrorKind` maps unknown 4xx to internal_error

- [ ] **A4.6.2 Test ProviderRegistry** (`registry.test.ts`)
      - `register` adds adapter to registry
      - `get` returns registered adapter
      - `get` returns undefined for unknown providerId
      - `list` returns all registered provider IDs
      - `getCapabilities` returns adapter capabilities
      - `healthCheckAll` calls healthCheck on all adapters

- [ ] **A4.6.3 Test telemetry emission** (`telemetry.test.ts`)
      - `setTelemetryEmitter` sets custom emitter function
      - `emitExecutionStarted` calls emitter with correct event type
      - `emitExecutionCompleted` includes metrics in event
      - `emitExecutionFailed` includes error kind and message
      - Default emitter is no-op (doesn't throw)

---

## A4.7 Integration Tests (Requires API Keys)

**File**: `src/lib/inference/__tests__/adapters/integration/`

These tests require real credentials and are skipped in CI.

- [ ] **A4.7.1 Test OpenAI adapter** (`openai.integration.test.ts`)
      - Skip if OPENAI_API_KEY not set
      - `generate` yields token events
      - `generate` returns metrics on completion
      - `generate` handles cancellation via AbortSignal
      - `healthCheck` returns true when API is reachable
      - Invalid model returns model_not_found error

- [ ] **A4.7.2 Test Ollama adapter** (`ollama.integration.test.ts`)
      - Skip if Ollama not running locally
      - `generate` yields token events
      - `healthCheck` returns true when Ollama is running
      - `healthCheck` returns false when Ollama is not running

---

## A4.8 UI Test Page

**Route**: `app/(test)/test/adapters/page.tsx`

Test page for validating real provider connections:

- [ ] **A4.8.1 Create adapter test page**
      - Display: List of registered providers with health status
      - Button: "Check Health" for each provider
      - Form: Simple prompt input with provider/model selection
      - Button: "Send Request" - sends test inference request
      - Display: Streaming output from selected provider
      - Display: Metrics after completion (tokens, latency)
      - Display: Error details if request fails

- [ ] **A4.8.2 Create adapter test endpoint**
      - `app/api/test/adapter/route.ts` - direct adapter test
      - Accepts provider ID, model ID, and prompt
      - Uses adapter directly (bypasses executor)
      - Returns SSE stream for token visualization
