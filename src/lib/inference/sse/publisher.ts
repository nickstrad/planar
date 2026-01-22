import type {
  TokenEvent,
  MetadataEvent,
  ErrorEvent,
  DoneEvent,
  ExecutionResult,
  ExecutionError,
  ExecutionMetrics,
} from "../types";
import type { StreamRegistry } from "./registry";

/**
 * Publisher interface for emitting stream events.
 *
 * The publisher is a thin wrapper - it just creates and publishes events.
 * All ordering logic (ensuring done is always sent, emitting first_token
 * with TTFB metrics) is the responsibility of the Executor.
 */
export interface StreamPublisher {
  /** Emit a token event */
  emitToken(token: string): void;

  /** Emit a metadata event (first_token or completion) */
  emitMetadata(params: {
    kind: "first_token" | "completion";
    metrics?: Partial<ExecutionMetrics>;
  }): void;

  /** Emit an error event */
  emitError(error: ExecutionError): void;

  /** Emit done event - must always be called, even after errors */
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
