import type { StreamEvent } from "../types";

/**
 * Metadata about an active or closed stream.
 */
export interface StreamMetadata {
  requestId: string;
  createdAt: number;
  eventCount: number;
  closed: boolean;
}

/**
 * Registry for managing SSE streams by request ID.
 */
export interface StreamRegistry {
  /**
   * Create a new stream for a request.
   * @param requestId - Unique identifier for the request
   * @param onCancel - Optional callback invoked when client disconnects
   * @returns ReadableStream that emits StreamEvents
   * @throws Error if stream already exists for this requestId
   */
  create(requestId: string, onCancel?: () => void): ReadableStream<StreamEvent>;

  /**
   * Publish an event to a stream.
   * Silently ignores if stream doesn't exist or is closed.
   */
  publish(requestId: string, event: StreamEvent): void;

  /**
   * Close a stream. Idempotent - safe to call multiple times.
   */
  close(requestId: string): void;

  /**
   * Check if a stream exists and is open.
   */
  has(requestId: string): boolean;

  /**
   * Get stream metadata for debugging.
   */
  getMetadata(requestId: string): StreamMetadata | null;
}

interface ActiveStream {
  controller: ReadableStreamDefaultController<StreamEvent>;
  metadata: StreamMetadata;
  onCancel?: () => void;
}

export interface StreamRegistryOptions {
  /** TTL for closed streams before cleanup, in ms. Default: 5 minutes */
  ttlMs?: number;
  /** Interval for cleanup checks, in ms. Default: 1 minute */
  cleanupIntervalMs?: number;
}

/**
 * Create an in-memory stream registry.
 *
 * Factory function enables isolated instances for testing.
 * For production, use the exported `streamRegistry` singleton.
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
        const age = now - stream.metadata.createdAt;
        if (stream.metadata.closed && age > ttlMs) {
          streams.delete(id);
        }
      }
    }, cleanupIntervalMs);
    // Don't prevent process exit
    if (cleanupTimer.unref) {
      cleanupTimer.unref();
    }
  }

  // Start cleanup on creation
  startCleanup();

  const registry: StreamRegistry = {
    create(
      requestId: string,
      onCancel?: () => void
    ): ReadableStream<StreamEvent> {
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
        return;
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
 * Default stream registry instance for production use.
 * Use createStreamRegistry() directly for testing.
 */
export const streamRegistry = createStreamRegistry();
