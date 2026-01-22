/**
 * Create an SSE response for Next.js App Router.
 *
 * Sets appropriate headers for server-sent events:
 * - Content-Type: text/event-stream
 * - Cache-Control: no-cache (prevents buffering)
 * - Connection: keep-alive
 * - X-Accel-Buffering: no (disables nginx buffering)
 */
export function createSSEResponse(
  stream: ReadableStream<Uint8Array>
): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
