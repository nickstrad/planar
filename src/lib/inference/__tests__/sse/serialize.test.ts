import { serializeSSE, serializeHeartbeat } from "../../sse/serialize";
import type { StreamEvent } from "../../types";

describe("serializeSSE", () => {
  const timestamp = 1234567890;

  it("produces correct event and data format for token events", () => {
    const event: StreamEvent = {
      type: "token",
      timestamp,
      data: { token: "Hello" },
    };

    const result = serializeSSE(event);

    expect(result).toBe(
      `event: token\ndata: {"type":"token","timestamp":1234567890,"data":{"token":"Hello"}}\n\n`
    );
  });

  it("produces correct format for metadata events", () => {
    const event: StreamEvent = {
      type: "metadata",
      timestamp,
      data: { kind: "first_token", metrics: { ttfbMs: 100 } },
    };

    const result = serializeSSE(event);

    expect(result).toContain("event: metadata\n");
    expect(result).toContain('"type":"metadata"');
    expect(result).toContain('"kind":"first_token"');
    expect(result).toContain('"ttfbMs":100');
  });

  it("produces correct format for error events", () => {
    const event: StreamEvent = {
      type: "error",
      timestamp,
      data: {
        error: {
          kind: "timeout",
          message: "Request timed out",
          providerId: "openai",
        },
      },
    };

    const result = serializeSSE(event);

    expect(result).toContain("event: error\n");
    expect(result).toContain('"kind":"timeout"');
    expect(result).toContain('"message":"Request timed out"');
  });

  it("produces correct format for done events", () => {
    const event: StreamEvent = {
      type: "done",
      timestamp,
      data: { result: null },
    };

    const result = serializeSSE(event);

    expect(result).toContain("event: done\n");
    expect(result).toContain('"result":null');
  });

  it("ends with double newline", () => {
    const event: StreamEvent = {
      type: "token",
      timestamp,
      data: { token: "test" },
    };

    const result = serializeSSE(event);

    expect(result.endsWith("\n\n")).toBe(true);
  });

  it("handles special characters in tokens", () => {
    const event: StreamEvent = {
      type: "token",
      timestamp,
      data: { token: 'Hello\n"World"\t\\' },
    };

    const result = serializeSSE(event);

    // JSON.stringify should escape special characters
    expect(result).toContain('\\"World\\"');
    expect(result).toContain("\\n");
    expect(result).toContain("\\t");
    expect(result).toContain("\\\\");
  });
});

describe("serializeHeartbeat", () => {
  it("produces valid SSE comment format", () => {
    const result = serializeHeartbeat();

    // SSE comments start with colon
    expect(result.startsWith(":")).toBe(true);
  });

  it("includes heartbeat identifier", () => {
    const result = serializeHeartbeat();

    expect(result).toContain("heartbeat");
  });

  it("includes timestamp", () => {
    const before = Date.now();
    const result = serializeHeartbeat();
    const after = Date.now();

    // Extract timestamp from result
    const match = result.match(/heartbeat (\d+)/);
    expect(match).not.toBeNull();

    const timestamp = parseInt(match![1], 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("ends with double newline", () => {
    const result = serializeHeartbeat();

    expect(result.endsWith("\n\n")).toBe(true);
  });
});
