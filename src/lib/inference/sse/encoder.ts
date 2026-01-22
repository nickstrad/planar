import type { StreamEvent } from "../types";
import { serializeSSE } from "./serialize";

/**
 * Create a TransformStream that encodes StreamEvents to SSE-formatted bytes.
 *
 * Usage:
 * ```ts
 * const eventStream: ReadableStream<StreamEvent> = ...;
 * const sseStream = eventStream.pipeThrough(createSSEEncoderStream());
 * return createSSEResponse(sseStream);
 * ```
 */
export function createSSEEncoderStream(): TransformStream<
  StreamEvent,
  Uint8Array
> {
  const encoder = new TextEncoder();

  return new TransformStream({
    transform(event, controller) {
      controller.enqueue(encoder.encode(serializeSSE(event)));
    },
  });
}
