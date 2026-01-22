import type { StreamEvent } from "../types";

/**
 * Serialize a stream event to SSE format.
 *
 * SSE format:
 * ```
 * event: <type>
 * data: <json>
 *
 * ```
 */
export function serializeSSE(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Serialize a heartbeat comment to keep the connection alive.
 * SSE comments start with a colon and are ignored by clients.
 */
export function serializeHeartbeat(): string {
  return `: heartbeat ${Date.now()}\n\n`;
}
