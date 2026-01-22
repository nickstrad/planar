"use client";

import { useState, useRef, useCallback } from "react";
import type { StreamEvent } from "@/lib/inference/types";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface EventLogEntry {
  id: number;
  timestamp: number;
  event: StreamEvent;
}

export default function StreamingTestPage() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [output, setOutput] = useState("");
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [delayMs, setDelayMs] = useState(100);
  const eventIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetState = useCallback(() => {
    setOutput("");
    setEvents([]);
    eventIdRef.current = 0;
  }, []);

  const startStream = useCallback(
    async (errorAt?: number) => {
      // Abort any existing stream
      abortControllerRef.current?.abort();

      resetState();
      setStatus("connecting");

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const params = new URLSearchParams({ delay: delayMs.toString() });
        if (errorAt !== undefined) {
          params.set("errorAt", errorAt.toString());
        }

        const response = await fetch(`/api/test/stream?${params}`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        setStatus("connected");

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let eventType = "";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ")) {
              eventData = line.slice(6);
            } else if (line === "" && eventType && eventData) {
              // End of event
              try {
                const event = JSON.parse(eventData) as StreamEvent;
                const entry: EventLogEntry = {
                  id: eventIdRef.current++,
                  timestamp: Date.now(),
                  event,
                };
                setEvents((prev) => [...prev, entry]);

                // Update output for token events
                if (event.type === "token") {
                  setOutput((prev) => prev + event.data.token);
                }
              } catch {
                console.error("Failed to parse event:", eventData);
              }
              eventType = "";
              eventData = "";
            }
          }
        }

        setStatus("disconnected");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setStatus("disconnected");
        } else {
          console.error("Stream error:", error);
          setStatus("error");
        }
      }
    },
    [delayMs, resetState]
  );

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStatus("disconnected");
  }, []);

  const getStatusColor = (s: ConnectionStatus) => {
    switch (s) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case "token":
        return "bg-blue-100 text-blue-800";
      case "metadata":
        return "bg-purple-100 text-purple-800";
      case "error":
        return "bg-red-100 text-red-800";
      case "done":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            SSE Streaming Test
          </h1>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${getStatusColor(status)}`}
            />
            <span className="text-sm text-gray-600 capitalize">{status}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">
              Token Delay (ms):
            </label>
            <input
              type="range"
              min="0"
              max="500"
              value={delayMs}
              onChange={(e) => setDelayMs(parseInt(e.target.value, 10))}
              className="w-32"
            />
            <span className="text-sm text-gray-600 w-12">{delayMs}ms</span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => startStream()}
              disabled={status === "connecting" || status === "connected"}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Mock Stream
            </button>
            <button
              onClick={() => startStream(5)}
              disabled={status === "connecting" || status === "connected"}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Stream with Error
            </button>
            <button
              onClick={cancelStream}
              disabled={status !== "connected" && status !== "connecting"}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel Stream
            </button>
          </div>
        </div>

        {/* Output Display */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            Streamed Output
          </h2>
          <div className="bg-gray-900 text-green-400 font-mono p-4 rounded-md min-h-[100px] whitespace-pre-wrap">
            {output || (
              <span className="text-gray-500">
                Output will appear here...
              </span>
            )}
            {status === "connected" && (
              <span className="inline-block w-2 h-4 bg-green-400 ml-1 animate-pulse" />
            )}
          </div>
        </div>

        {/* Event Log */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            Event Log ({events.length} events)
          </h2>
          <div className="bg-gray-50 border rounded-md max-h-[400px] overflow-y-auto">
            {events.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">No events yet...</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600">#</th>
                    <th className="px-3 py-2 text-left text-gray-600">Type</th>
                    <th className="px-3 py-2 text-left text-gray-600">
                      Timestamp
                    </th>
                    <th className="px-3 py-2 text-left text-gray-600">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {events.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500">{entry.id}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getEventBadgeColor(entry.event.type)}`}
                        >
                          {entry.event.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                        {new Date(entry.event.timestamp).toLocaleTimeString(
                          "en-US",
                          {
                            hour12: false,
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            fractionalSecondDigits: 3,
                          }
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700 font-mono text-xs max-w-md truncate">
                        {JSON.stringify(entry.event.data)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
