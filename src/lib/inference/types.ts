/**
 * Inference Contracts & Types
 *
 * Core type definitions for the inference runtime (Project A).
 * These types are consumed by SSE Engine (A3), Adapters (A4), and Executor (A5).
 */

// =============================================================================
//  Message and Request Types
// =============================================================================

export type MessageRole = "system" | "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
  // Future: tool_calls, tool_call_id for function calling
}

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
export const DEFAULT_INFERENCE_OPTIONS: Required<
  Pick<InferenceOptions, "stream">
> = {
  stream: true,
};

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

// =============================================================================
// Routing Plan Contract
// =============================================================================

/**
 * Minimal provider info needed by Project A.
 * Project B will extend this with routing metadata (strategy, snapshot, etc.).
 */
export interface ResolvedProvider {
  /** Provider identifier (e.g., "openai", "ollama") */
  providerId: string;

  /** Model identifier for this provider (e.g., "gpt-4o", "llama3.2") */
  modelId: string;
}

/**
 * Minimal routing plan interface for Project A.
 * Project B will define the full RoutingPlan with:
 * - Routing strategy metadata
 * - Resolution snapshot for replay/debugging
 * - Provider-specific options
 */
export interface RoutingPlan {
  /** Primary provider to use */
  primary: ResolvedProvider;

  /** Fallback providers if primary fails (ordered) */
  fallbacks: ResolvedProvider[];
}

// =============================================================================
// Execution Input/Output Contracts
// =============================================================================

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

// =============================================================================
// Stream Event Types
// =============================================================================

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

// -----------------------------------------------------------------------------
// Type guards for stream events
// -----------------------------------------------------------------------------

/** Type guard for TokenEvent */
export function isTokenEvent(event: StreamEvent): event is TokenEvent {
  return event.type === "token";
}

/** Type guard for MetadataEvent */
export function isMetadataEvent(event: StreamEvent): event is MetadataEvent {
  return event.type === "metadata";
}

/** Type guard for ErrorEvent */
export function isErrorEvent(event: StreamEvent): event is ErrorEvent {
  return event.type === "error";
}

/** Type guard for DoneEvent */
export function isDoneEvent(event: StreamEvent): event is DoneEvent {
  return event.type === "done";
}

// =============================================================================
// A2.5 Error Types
// =============================================================================

/**
 * Normalized error kinds across all providers.
 * Used for consistent error handling and retry logic.
 */
export type ErrorKind =
  | "provider_error" // Provider returned an error
  | "rate_limit" // Rate limited by provider
  | "auth_error" // Authentication failed
  | "model_not_found" // Model doesn't exist
  | "context_length" // Input too long
  | "timeout" // Request timed out
  | "cancelled" // Request was cancelled
  | "network_error" // Network connectivity issue
  | "internal_error"; // Platform internal error

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
}

// -----------------------------------------------------------------------------
// Error classification
// -----------------------------------------------------------------------------

/**
 * Errors that can trigger a retry within the same provider.
 */
const RETRYABLE_ERROR_KINDS: ReadonlySet<ErrorKind> = new Set([
  "rate_limit",
  "network_error",
  "timeout",
]);

/**
 * Errors that can trigger fallback to next provider.
 * Superset of retryable errors plus some provider-specific failures.
 */
const FALLBACK_ERROR_KINDS: ReadonlySet<ErrorKind> = new Set([
  "rate_limit",
  "network_error",
  "timeout",
  "provider_error",
  "model_not_found",
]);

/**
 * Check if an error kind should trigger retry within the same provider.
 */
export function isRetryableError(error: ExecutionError): boolean {
  return RETRYABLE_ERROR_KINDS.has(error.kind);
}

/**
 * Check if an error kind should trigger fallback to next provider.
 */
export function shouldFallback(error: ExecutionError): boolean {
  return FALLBACK_ERROR_KINDS.has(error.kind);
}

// -----------------------------------------------------------------------------
// Error factory functions
// -----------------------------------------------------------------------------

/**
 * Create a normalized execution error.
 */
export function createExecutionError(
  kind: ErrorKind,
  message: string,
  providerId: string,
  providerError?: ExecutionError["providerError"],
): ExecutionError {
  return {
    kind,
    message,
    providerId,
    providerError,
  };
}

/**
 * Create timeout error.
 */
export function createTimeoutError(
  providerId: string,
  timeoutMs: number,
): ExecutionError {
  return createExecutionError(
    "timeout",
    `Request timed out after ${timeoutMs}ms`,
    providerId,
  );
}

/**
 * Create cancellation error.
 */
export function createCancellationError(providerId: string): ExecutionError {
  return createExecutionError("cancelled", "Request was cancelled", providerId);
}

// =============================================================================
// A2.6 Provider Adapter Types
// =============================================================================

/**
 * Provider capabilities reported by each adapter.
 * Model-specific capabilities (context length, supported models) are
 * validated by Project B during routing — not duplicated here.
 */
export interface ProviderCapabilities {
  /** Whether provider supports streaming */
  supportsStreaming: boolean;

  /** Whether provider supports function/tool calls */
  supportsTools: boolean;
}

/**
 * Adapter interface that all providers must implement.
 * Defined here, implemented in Section A4.
 *
 * Error handling: Adapters throw ExecutionError on failure.
 * The executor catches and handles retry/fallback logic.
 */
export interface ProviderAdapter {
  /** Unique provider identifier */
  readonly providerId: string;

  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;

  /**
   * Execute inference and yield token events.
   *
   * @param request - The inference request
   * @param provider - Resolved provider configuration
   * @param signal - AbortSignal for cancellation
   * @returns AsyncGenerator yielding tokens, returns metrics on completion
   * @throws ExecutionError on failure (executor handles retry/fallback)
   */
  generate(
    request: InferenceRequest,
    provider: ResolvedProvider,
    signal?: AbortSignal,
  ): AsyncGenerator<TokenEvent, ExecutionMetrics, undefined>;

  /**
   * Check if provider is healthy/reachable.
   */
  healthCheck(): Promise<boolean>;
}

// =============================================================================
// A2.7 Telemetry Types
// =============================================================================

/**
 * Minimal telemetry emitter interface.
 * Project D will provide the concrete implementation and full event types.
 */
export interface TelemetryEmitter {
  emit(event: {
    type: "execution_started" | "execution_completed" | "execution_failed";
    requestId: string;
    providerId: string;
    modelId: string;
    timestamp: number;
    metrics?: ExecutionMetrics;
    error?: Pick<ExecutionError, "kind" | "message">;
  }): void;
}

/**
 * No-op telemetry emitter for use until Project D is implemented.
 */
export const noopTelemetryEmitter: TelemetryEmitter = {
  emit: () => {},
};
