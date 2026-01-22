import { createStreamPublisher } from "../../sse/publisher";
import type { StreamRegistry } from "../../sse/registry";
import type { StreamEvent, ExecutionError } from "../../types";

/**
 * Create a mock registry that captures published events.
 */
function createMockRegistry(): StreamRegistry & { events: StreamEvent[] } {
  const events: StreamEvent[] = [];

  return {
    events,
    create: jest.fn(),
    publish: jest.fn((requestId: string, event: StreamEvent) => {
      events.push(event);
    }),
    close: jest.fn(),
    has: jest.fn(() => true),
    getMetadata: jest.fn(() => null),
  };
}

describe("createStreamPublisher", () => {
  it("uses injected registry, not global", () => {
    const mockRegistry = createMockRegistry();
    const publisher = createStreamPublisher({
      requestId: "request-1",
      registry: mockRegistry,
    });

    publisher.emitToken("Hello");

    expect(mockRegistry.publish).toHaveBeenCalledWith(
      "request-1",
      expect.any(Object)
    );
  });
});

describe("StreamPublisher", () => {
  describe("emitToken", () => {
    it("publishes token event with correct structure", () => {
      const mockRegistry = createMockRegistry();
      const publisher = createStreamPublisher({
        requestId: "request-1",
        registry: mockRegistry,
      });

      publisher.emitToken("Hello");

      expect(mockRegistry.events).toHaveLength(1);
      const event = mockRegistry.events[0];
      expect(event.type).toBe("token");
      expect(event.data).toEqual({ token: "Hello" });
      expect(typeof event.timestamp).toBe("number");
    });

    it("includes current timestamp", () => {
      const mockRegistry = createMockRegistry();
      const publisher = createStreamPublisher({
        requestId: "request-1",
        registry: mockRegistry,
      });

      const before = Date.now();
      publisher.emitToken("Hello");
      const after = Date.now();

      const event = mockRegistry.events[0];
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.timestamp).toBeLessThanOrEqual(after);
    });

    it("handles empty tokens", () => {
      const mockRegistry = createMockRegistry();
      const publisher = createStreamPublisher({
        requestId: "request-1",
        registry: mockRegistry,
      });

      publisher.emitToken("");

      expect(mockRegistry.events[0].data).toEqual({ token: "" });
    });
  });

  describe("emitMetadata", () => {
    it("publishes first_token metadata event", () => {
      const mockRegistry = createMockRegistry();
      const publisher = createStreamPublisher({
        requestId: "request-1",
        registry: mockRegistry,
      });

      publisher.emitMetadata({ kind: "first_token", metrics: { ttfbMs: 150 } });

      expect(mockRegistry.events).toHaveLength(1);
      const event = mockRegistry.events[0];
      expect(event.type).toBe("metadata");
      expect(event.data).toEqual({
        kind: "first_token",
        metrics: { ttfbMs: 150 },
      });
    });

    it("publishes completion metadata event", () => {
      const mockRegistry = createMockRegistry();
      const publisher = createStreamPublisher({
        requestId: "request-1",
        registry: mockRegistry,
      });

      publisher.emitMetadata({
        kind: "completion",
        metrics: {
          promptTokens: 10,
          completionTokens: 50,
          totalMs: 1000,
        },
      });

      const event = mockRegistry.events[0];
      expect(event.type).toBe("metadata");
      expect(event.data).toEqual({
        kind: "completion",
        metrics: {
          promptTokens: 10,
          completionTokens: 50,
          totalMs: 1000,
        },
      });
    });

    it("handles missing metrics", () => {
      const mockRegistry = createMockRegistry();
      const publisher = createStreamPublisher({
        requestId: "request-1",
        registry: mockRegistry,
      });

      publisher.emitMetadata({ kind: "first_token" });

      const event = mockRegistry.events[0];
      expect(event.data).toEqual({
        kind: "first_token",
        metrics: undefined,
      });
    });
  });

  describe("emitError", () => {
    it("publishes error event with full error details", () => {
      const mockRegistry = createMockRegistry();
      const publisher = createStreamPublisher({
        requestId: "request-1",
        registry: mockRegistry,
      });

      const error: ExecutionError = {
        kind: "timeout",
        message: "Request timed out after 30000ms",
        providerId: "openai",
        providerError: {
          code: "ETIMEDOUT",
          status: 504,
        },
      };

      publisher.emitError(error);

      expect(mockRegistry.events).toHaveLength(1);
      const event = mockRegistry.events[0];
      expect(event.type).toBe("error");
      expect(event.data).toEqual({ error });
    });
  });

  describe("emitDone", () => {
    it("publishes done event with result", () => {
      const mockRegistry = createMockRegistry();
      const publisher = createStreamPublisher({
        requestId: "request-1",
        registry: mockRegistry,
      });

      const result = {
        success: true,
        resolvedProvider: { providerId: "openai", modelId: "gpt-4o" },
        metrics: {
          promptTokens: 10,
          completionTokens: 50,
          ttfbMs: 100,
          totalMs: 500,
          retryCount: 0,
        },
        error: null,
        fallbackCount: 0,
      };

      publisher.emitDone(result);

      expect(mockRegistry.events).toHaveLength(1);
      const event = mockRegistry.events[0];
      expect(event.type).toBe("done");
      expect(event.data).toEqual({ result });
    });

    it("publishes done event with null result", () => {
      const mockRegistry = createMockRegistry();
      const publisher = createStreamPublisher({
        requestId: "request-1",
        registry: mockRegistry,
      });

      publisher.emitDone(null);

      const event = mockRegistry.events[0];
      expect(event.type).toBe("done");
      expect(event.data).toEqual({ result: null });
    });
  });

  describe("multiple events", () => {
    it("emits events in order", () => {
      const mockRegistry = createMockRegistry();
      const publisher = createStreamPublisher({
        requestId: "request-1",
        registry: mockRegistry,
      });

      publisher.emitMetadata({ kind: "first_token", metrics: { ttfbMs: 100 } });
      publisher.emitToken("Hello");
      publisher.emitToken(" World");
      publisher.emitMetadata({ kind: "completion" });
      publisher.emitDone(null);

      expect(mockRegistry.events).toHaveLength(5);
      expect(mockRegistry.events[0].type).toBe("metadata");
      expect(mockRegistry.events[1].type).toBe("token");
      expect(mockRegistry.events[2].type).toBe("token");
      expect(mockRegistry.events[3].type).toBe("metadata");
      expect(mockRegistry.events[4].type).toBe("done");
    });

    it("handles error then done sequence", () => {
      const mockRegistry = createMockRegistry();
      const publisher = createStreamPublisher({
        requestId: "request-1",
        registry: mockRegistry,
      });

      publisher.emitToken("Partial");
      publisher.emitError({
        kind: "network_error",
        message: "Connection lost",
        providerId: "openai",
      });
      publisher.emitDone(null);

      expect(mockRegistry.events).toHaveLength(3);
      expect(mockRegistry.events[0].type).toBe("token");
      expect(mockRegistry.events[1].type).toBe("error");
      expect(mockRegistry.events[2].type).toBe("done");
    });
  });
});
