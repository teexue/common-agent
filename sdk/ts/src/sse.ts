import type { AgentEvent } from "./types.js"

/**
 * Parse a single SSE "data:" line into an AgentEvent.
 * Returns null for non-data lines or parse failures.
 */
export function parseSSELine(line: string): AgentEvent | null {
  if (!line.startsWith("data: ")) return null
  try {
    return JSON.parse(line.slice(6)) as AgentEvent
  } catch {
    return null
  }
}

/**
 * Read an SSE stream from a ReadableStream and yield AgentEvents.
 * Handles buffering, line splitting, and the double-newline SSE framing.
 */
export async function* readSSEStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError")
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete lines.
      const lines = buffer.split("\n")
      // Keep the last incomplete line in the buffer.
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed === "") continue

        const event = parseSSELine(trimmed)
        if (event) {
          yield event
          // Stop on done event.
          if (event.type === "done") return
        }
      }
    }

    // Process any remaining data in the buffer.
    if (buffer.trim()) {
      const event = parseSSELine(buffer.trim())
      if (event) yield event
    }
  } finally {
    reader.releaseLock()
  }
}
