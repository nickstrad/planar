import {
  createStreamRegistry,
  createStreamPublisher,
  createSSEEncoderStream,
  createSSEResponse,
} from "@/lib/inference/sse";
import type { ExecutionResult } from "@/lib/inference/types";

const MOCK_TOKENS = [
  "Hello",
  "!",
  " I'm",
  " a",
  " streaming",
  " response",
  " from",
  " the",
  " mock",
  " endpoint",
  ".",
  " Each",
  " token",
  " arrives",
  " with",
  " a",
  " configurable",
  " delay",
  ".",
];

interface MockStreamParams {
  delayMs: number;
  errorAtToken: number | null;
}

function parseSearchParams(url: URL): MockStreamParams {
  const delayMs = parseInt(url.searchParams.get("delay") ?? "100", 10);
  const errorAtToken = url.searchParams.get("errorAt");

  return {
    delayMs: isNaN(delayMs) ? 100 : Math.max(0, Math.min(delayMs, 2000)),
    errorAtToken: errorAtToken ? parseInt(errorAtToken, 10) : null,
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { delayMs, errorAtToken } = parseSearchParams(url);
  const requestId = crypto.randomUUID();

  // Create isolated registry for this request
  const registry = createStreamRegistry();

  // Create abort controller for client disconnect handling
  const abortController = new AbortController();

  // Create stream with cancel callback
  const eventStream = registry.create(requestId, () => {
    abortController.abort();
  });

  // Pipe through SSE encoder
  const encodedStream = eventStream.pipeThrough(createSSEEncoderStream());

  // Create publisher
  const publisher = createStreamPublisher({ requestId, registry });

  // Start streaming in background
  (async () => {
    const startTime = Date.now();
    let tokenCount = 0;

    try {
      for (let i = 0; i < MOCK_TOKENS.length; i++) {
        // Check for abort
        if (abortController.signal.aborted) {
          break;
        }

        // Simulate error at specific token
        if (errorAtToken !== null && i === errorAtToken) {
          publisher.emitError({
            kind: "provider_error",
            message: `Simulated error at token ${i}`,
            providerId: "mock",
            providerError: {
              code: "MOCK_ERROR",
              message: "This is a simulated error for testing",
              status: 500,
            },
          });
          publisher.emitDone(null);
          return;
        }

        // Emit first_token metadata on first token
        if (i === 0) {
          publisher.emitMetadata({
            kind: "first_token",
            metrics: { ttfbMs: Date.now() - startTime },
          });
        }

        // Emit token
        publisher.emitToken(MOCK_TOKENS[i]);
        tokenCount++;

        // Delay between tokens (except after last)
        if (i < MOCK_TOKENS.length - 1) {
          await sleep(delayMs, abortController.signal);
        }
      }

      // Emit completion metadata
      const totalMs = Date.now() - startTime;
      publisher.emitMetadata({
        kind: "completion",
        metrics: {
          promptTokens: 10,
          completionTokens: tokenCount,
          ttfbMs: delayMs,
          totalMs,
          retryCount: 0,
        },
      });

      // Emit done with result
      const result: ExecutionResult = {
        success: true,
        resolvedProvider: { providerId: "mock", modelId: "mock-model" },
        metrics: {
          promptTokens: 10,
          completionTokens: tokenCount,
          ttfbMs: delayMs,
          totalMs,
          retryCount: 0,
        },
        error: null,
        fallbackCount: 0,
      };
      publisher.emitDone(result);
    } catch (error) {
      // Handle abort
      if (error instanceof DOMException && error.name === "AbortError") {
        publisher.emitError({
          kind: "cancelled",
          message: "Stream cancelled by client",
          providerId: "mock",
        });
        publisher.emitDone(null);
        return;
      }

      // Handle unexpected errors
      publisher.emitError({
        kind: "internal_error",
        message: error instanceof Error ? error.message : "Unknown error",
        providerId: "mock",
      });
      publisher.emitDone(null);
    }
  })();

  return createSSEResponse(encodedStream);
}
