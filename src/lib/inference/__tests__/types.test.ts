import {
  // Error classification
  isRetryableError,
  shouldFallback,
  createExecutionError,
  createTimeoutError,
  createCancellationError,
  // Type guards
  isTokenEvent,
  isMetadataEvent,
  isErrorEvent,
  isDoneEvent,
  // Defaults
  DEFAULT_INFERENCE_OPTIONS,
  DEFAULT_EXECUTION_CONTROLS,
  // Types
  type ExecutionError,
  type StreamEvent,
} from "../types";

describe("Error Classification", () => {
  describe("isRetryableError", () => {
    it("returns true for rate_limit", () => {
      const error: ExecutionError = {
        kind: "rate_limit",
        message: "Rate limited",
        providerId: "openai",
      };
      expect(isRetryableError(error)).toBe(true);
    });

    it("returns true for network_error", () => {
      const error: ExecutionError = {
        kind: "network_error",
        message: "Network error",
        providerId: "openai",
      };
      expect(isRetryableError(error)).toBe(true);
    });

    it("returns true for timeout", () => {
      const error: ExecutionError = {
        kind: "timeout",
        message: "Timeout",
        providerId: "openai",
      };
      expect(isRetryableError(error)).toBe(true);
    });

    it("returns false for auth_error", () => {
      const error: ExecutionError = {
        kind: "auth_error",
        message: "Auth failed",
        providerId: "openai",
      };
      expect(isRetryableError(error)).toBe(false);
    });

    it("returns false for cancelled", () => {
      const error: ExecutionError = {
        kind: "cancelled",
        message: "Cancelled",
        providerId: "openai",
      };
      expect(isRetryableError(error)).toBe(false);
    });

    it("returns false for context_length", () => {
      const error: ExecutionError = {
        kind: "context_length",
        message: "Context too long",
        providerId: "openai",
      };
      expect(isRetryableError(error)).toBe(false);
    });

    it("returns false for provider_error", () => {
      const error: ExecutionError = {
        kind: "provider_error",
        message: "Provider error",
        providerId: "openai",
      };
      expect(isRetryableError(error)).toBe(false);
    });

    it("returns false for internal_error", () => {
      const error: ExecutionError = {
        kind: "internal_error",
        message: "Internal error",
        providerId: "openai",
      };
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe("shouldFallback", () => {
    it("returns true for rate_limit", () => {
      const error: ExecutionError = {
        kind: "rate_limit",
        message: "Rate limited",
        providerId: "openai",
      };
      expect(shouldFallback(error)).toBe(true);
    });

    it("returns true for network_error", () => {
      const error: ExecutionError = {
        kind: "network_error",
        message: "Network error",
        providerId: "openai",
      };
      expect(shouldFallback(error)).toBe(true);
    });

    it("returns true for timeout", () => {
      const error: ExecutionError = {
        kind: "timeout",
        message: "Timeout",
        providerId: "openai",
      };
      expect(shouldFallback(error)).toBe(true);
    });

    it("returns true for provider_error", () => {
      const error: ExecutionError = {
        kind: "provider_error",
        message: "Provider error",
        providerId: "openai",
      };
      expect(shouldFallback(error)).toBe(true);
    });

    it("returns true for model_not_found", () => {
      const error: ExecutionError = {
        kind: "model_not_found",
        message: "Model not found",
        providerId: "openai",
      };
      expect(shouldFallback(error)).toBe(true);
    });

    it("returns false for auth_error", () => {
      const error: ExecutionError = {
        kind: "auth_error",
        message: "Auth failed",
        providerId: "openai",
      };
      expect(shouldFallback(error)).toBe(false);
    });

    it("returns false for context_length", () => {
      const error: ExecutionError = {
        kind: "context_length",
        message: "Context too long",
        providerId: "openai",
      };
      expect(shouldFallback(error)).toBe(false);
    });

    it("returns false for cancelled", () => {
      const error: ExecutionError = {
        kind: "cancelled",
        message: "Cancelled",
        providerId: "openai",
      };
      expect(shouldFallback(error)).toBe(false);
    });

    it("returns false for internal_error", () => {
      const error: ExecutionError = {
        kind: "internal_error",
        message: "Internal error",
        providerId: "openai",
      };
      expect(shouldFallback(error)).toBe(false);
    });
  });
});

describe("Error Factory Functions", () => {
  describe("createExecutionError", () => {
    it("creates error with correct kind", () => {
      const error = createExecutionError(
        "rate_limit",
        "Rate limited",
        "openai"
      );
      expect(error.kind).toBe("rate_limit");
    });

    it("creates error with correct message", () => {
      const error = createExecutionError(
        "auth_error",
        "Invalid API key",
        "openai"
      );
      expect(error.message).toBe("Invalid API key");
    });

    it("creates error with correct providerId", () => {
      const error = createExecutionError(
        "timeout",
        "Timeout",
        "anthropic"
      );
      expect(error.providerId).toBe("anthropic");
    });

    it("includes providerError when provided", () => {
      const error = createExecutionError(
        "provider_error",
        "Bad request",
        "openai",
        { code: "invalid_request", status: 400, message: "Invalid model" }
      );
      expect(error.providerError).toEqual({
        code: "invalid_request",
        status: 400,
        message: "Invalid model",
      });
    });

    it("omits providerError when not provided", () => {
      const error = createExecutionError(
        "network_error",
        "Network error",
        "openai"
      );
      expect(error.providerError).toBeUndefined();
    });
  });

  describe("createTimeoutError", () => {
    it("creates timeout error with correct kind", () => {
      const error = createTimeoutError("openai", 30000);
      expect(error.kind).toBe("timeout");
    });

    it("creates timeout error with correct message", () => {
      const error = createTimeoutError("openai", 30000);
      expect(error.message).toBe("Request timed out after 30000ms");
    });

    it("creates timeout error with correct providerId", () => {
      const error = createTimeoutError("ollama", 60000);
      expect(error.providerId).toBe("ollama");
    });
  });

  describe("createCancellationError", () => {
    it("creates cancelled error with correct kind", () => {
      const error = createCancellationError("openai");
      expect(error.kind).toBe("cancelled");
    });

    it("creates cancelled error with correct message", () => {
      const error = createCancellationError("openai");
      expect(error.message).toBe("Request was cancelled");
    });

    it("creates cancelled error with correct providerId", () => {
      const error = createCancellationError("anthropic");
      expect(error.providerId).toBe("anthropic");
    });
  });
});

describe("Type Guards", () => {
  const timestamp = Date.now();

  describe("isTokenEvent", () => {
    it("returns true for token events", () => {
      const event: StreamEvent = {
        type: "token",
        timestamp,
        data: { token: "Hello" },
      };
      expect(isTokenEvent(event)).toBe(true);
    });

    it("returns false for metadata events", () => {
      const event: StreamEvent = {
        type: "metadata",
        timestamp,
        data: { kind: "first_token" },
      };
      expect(isTokenEvent(event)).toBe(false);
    });

    it("returns false for error events", () => {
      const event: StreamEvent = {
        type: "error",
        timestamp,
        data: {
          error: { kind: "timeout", message: "Timeout", providerId: "openai" },
        },
      };
      expect(isTokenEvent(event)).toBe(false);
    });

    it("returns false for done events", () => {
      const event: StreamEvent = {
        type: "done",
        timestamp,
        data: { result: null },
      };
      expect(isTokenEvent(event)).toBe(false);
    });

    it("narrows type correctly", () => {
      const event: StreamEvent = {
        type: "token",
        timestamp,
        data: { token: "Hello" },
      };
      if (isTokenEvent(event)) {
        // TypeScript should allow access to token-specific properties
        expect(event.data.token).toBe("Hello");
      }
    });
  });

  describe("isMetadataEvent", () => {
    it("returns true for metadata events", () => {
      const event: StreamEvent = {
        type: "metadata",
        timestamp,
        data: { kind: "first_token" },
      };
      expect(isMetadataEvent(event)).toBe(true);
    });

    it("returns false for token events", () => {
      const event: StreamEvent = {
        type: "token",
        timestamp,
        data: { token: "Hello" },
      };
      expect(isMetadataEvent(event)).toBe(false);
    });

    it("narrows type correctly", () => {
      const event: StreamEvent = {
        type: "metadata",
        timestamp,
        data: { kind: "completion", metrics: { ttfbMs: 100 } },
      };
      if (isMetadataEvent(event)) {
        expect(event.data.kind).toBe("completion");
        expect(event.data.metrics?.ttfbMs).toBe(100);
      }
    });
  });

  describe("isErrorEvent", () => {
    it("returns true for error events", () => {
      const event: StreamEvent = {
        type: "error",
        timestamp,
        data: {
          error: { kind: "timeout", message: "Timeout", providerId: "openai" },
        },
      };
      expect(isErrorEvent(event)).toBe(true);
    });

    it("returns false for token events", () => {
      const event: StreamEvent = {
        type: "token",
        timestamp,
        data: { token: "Hello" },
      };
      expect(isErrorEvent(event)).toBe(false);
    });

    it("narrows type correctly", () => {
      const event: StreamEvent = {
        type: "error",
        timestamp,
        data: {
          error: {
            kind: "rate_limit",
            message: "Rate limited",
            providerId: "openai",
          },
        },
      };
      if (isErrorEvent(event)) {
        expect(event.data.error.kind).toBe("rate_limit");
      }
    });
  });

  describe("isDoneEvent", () => {
    it("returns true for done events", () => {
      const event: StreamEvent = {
        type: "done",
        timestamp,
        data: { result: null },
      };
      expect(isDoneEvent(event)).toBe(true);
    });

    it("returns false for token events", () => {
      const event: StreamEvent = {
        type: "token",
        timestamp,
        data: { token: "Hello" },
      };
      expect(isDoneEvent(event)).toBe(false);
    });

    it("narrows type correctly with null result", () => {
      const event: StreamEvent = {
        type: "done",
        timestamp,
        data: { result: null },
      };
      if (isDoneEvent(event)) {
        expect(event.data.result).toBeNull();
      }
    });

    it("narrows type correctly with result", () => {
      const event: StreamEvent = {
        type: "done",
        timestamp,
        data: {
          result: {
            success: true,
            resolvedProvider: { providerId: "openai", modelId: "gpt-4o" },
            metrics: {
              promptTokens: 10,
              completionTokens: 20,
              ttfbMs: 100,
              totalMs: 500,
              retryCount: 0,
            },
            error: null,
            fallbackCount: 0,
          },
        },
      };
      if (isDoneEvent(event)) {
        expect(event.data.result?.success).toBe(true);
        expect(event.data.result?.resolvedProvider.modelId).toBe("gpt-4o");
      }
    });
  });
});

describe("Default Values", () => {
  describe("DEFAULT_INFERENCE_OPTIONS", () => {
    it("has stream set to true", () => {
      expect(DEFAULT_INFERENCE_OPTIONS.stream).toBe(true);
    });
  });

  describe("DEFAULT_EXECUTION_CONTROLS", () => {
    it("has timeoutMs set to 60000", () => {
      expect(DEFAULT_EXECUTION_CONTROLS.timeoutMs).toBe(60_000);
    });

    it("has maxRetries set to 1", () => {
      expect(DEFAULT_EXECUTION_CONTROLS.maxRetries).toBe(1);
    });
  });
});
