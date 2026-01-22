import { createStreamRegistry } from "../../sse/registry";
import type { StreamEvent } from "../../types";

describe("createStreamRegistry", () => {
  it("creates isolated registry instances", () => {
    const registry1 = createStreamRegistry();
    const registry2 = createStreamRegistry();

    registry1.create("request-1");

    expect(registry1.has("request-1")).toBe(true);
    expect(registry2.has("request-1")).toBe(false);
  });
});

describe("StreamRegistry", () => {
  describe("create", () => {
    it("returns a ReadableStream", () => {
      const registry = createStreamRegistry();
      const stream = registry.create("request-1");

      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it("throws if stream already exists for requestId", () => {
      const registry = createStreamRegistry();
      registry.create("request-1");

      expect(() => registry.create("request-1")).toThrow(
        "Stream already exists for request request-1"
      );
    });

    it("calls onCancel when stream is cancelled", async () => {
      const registry = createStreamRegistry();
      const onCancel = jest.fn();

      const stream = registry.create("request-1", onCancel);
      const reader = stream.getReader();

      // Cancel the stream (simulates client disconnect)
      await reader.cancel();

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("closes stream when cancelled", async () => {
      const registry = createStreamRegistry();
      const stream = registry.create("request-1");
      const reader = stream.getReader();

      await reader.cancel();

      expect(registry.has("request-1")).toBe(false);
    });
  });

  describe("publish", () => {
    it("enqueues events to correct stream", async () => {
      const registry = createStreamRegistry();
      const stream = registry.create("request-1");
      const reader = stream.getReader();

      const event: StreamEvent = {
        type: "token",
        timestamp: Date.now(),
        data: { token: "Hello" },
      };

      registry.publish("request-1", event);

      const { value, done } = await reader.read();
      expect(done).toBe(false);
      expect(value).toEqual(event);
    });

    it("silently ignores unknown requestId", () => {
      const registry = createStreamRegistry();

      // Should not throw
      expect(() => {
        registry.publish("unknown-request", {
          type: "token",
          timestamp: Date.now(),
          data: { token: "Hello" },
        });
      }).not.toThrow();
    });

    it("ignores events for closed streams", async () => {
      const registry = createStreamRegistry();
      const stream = registry.create("request-1");
      const reader = stream.getReader();

      registry.close("request-1");

      // Should not throw
      registry.publish("request-1", {
        type: "token",
        timestamp: Date.now(),
        data: { token: "Hello" },
      });

      // Stream should be closed
      const { done } = await reader.read();
      expect(done).toBe(true);
    });
  });

  describe("close", () => {
    it("closes the stream controller", async () => {
      const registry = createStreamRegistry();
      const stream = registry.create("request-1");
      const reader = stream.getReader();

      registry.close("request-1");

      const { done } = await reader.read();
      expect(done).toBe(true);
    });

    it("is idempotent - can be called multiple times", () => {
      const registry = createStreamRegistry();
      registry.create("request-1");

      // Should not throw
      registry.close("request-1");
      registry.close("request-1");
      registry.close("request-1");
    });

    it("handles closing non-existent stream", () => {
      const registry = createStreamRegistry();

      // Should not throw
      expect(() => registry.close("unknown-request")).not.toThrow();
    });
  });

  describe("auto-close on done event", () => {
    it("closes stream when done event is published", async () => {
      const registry = createStreamRegistry();
      const stream = registry.create("request-1");
      const reader = stream.getReader();

      const doneEvent: StreamEvent = {
        type: "done",
        timestamp: Date.now(),
        data: { result: null },
      };

      registry.publish("request-1", doneEvent);

      // Read the done event
      const { value } = await reader.read();
      expect(value?.type).toBe("done");

      // Stream should now be closed
      expect(registry.has("request-1")).toBe(false);

      // Next read should indicate done
      const { done } = await reader.read();
      expect(done).toBe(true);
    });
  });

  describe("has", () => {
    it("returns true for open streams", () => {
      const registry = createStreamRegistry();
      registry.create("request-1");

      expect(registry.has("request-1")).toBe(true);
    });

    it("returns false for closed streams", () => {
      const registry = createStreamRegistry();
      registry.create("request-1");
      registry.close("request-1");

      expect(registry.has("request-1")).toBe(false);
    });

    it("returns false for non-existent streams", () => {
      const registry = createStreamRegistry();

      expect(registry.has("unknown-request")).toBe(false);
    });
  });

  describe("getMetadata", () => {
    it("returns metadata for existing stream", () => {
      const registry = createStreamRegistry();
      registry.create("request-1");

      const metadata = registry.getMetadata("request-1");

      expect(metadata).not.toBeNull();
      expect(metadata?.requestId).toBe("request-1");
      expect(metadata?.eventCount).toBe(0);
      expect(metadata?.closed).toBe(false);
      expect(typeof metadata?.createdAt).toBe("number");
    });

    it("returns null for non-existent stream", () => {
      const registry = createStreamRegistry();

      expect(registry.getMetadata("unknown-request")).toBeNull();
    });

    it("tracks eventCount correctly", () => {
      const registry = createStreamRegistry();
      registry.create("request-1");

      registry.publish("request-1", {
        type: "token",
        timestamp: Date.now(),
        data: { token: "Hello" },
      });
      registry.publish("request-1", {
        type: "token",
        timestamp: Date.now(),
        data: { token: " World" },
      });

      const metadata = registry.getMetadata("request-1");
      expect(metadata?.eventCount).toBe(2);
    });

    it("reflects closed status", () => {
      const registry = createStreamRegistry();
      registry.create("request-1");

      expect(registry.getMetadata("request-1")?.closed).toBe(false);

      registry.close("request-1");

      expect(registry.getMetadata("request-1")?.closed).toBe(true);
    });
  });
});
