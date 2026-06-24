import { useEffect, useRef } from "react"

interface AgentEvent {
  type: "agent_created" | "agent_updated" | "agent_deleted" | "ping"
  name?: string
}

interface UseAgentEventsOptions {
  onAgentChange?: (event: AgentEvent) => void
  enabled?: boolean
}

/**
 * Connects to /v1/events SSE endpoint and calls onAgentChange
 * when an agent file is created, updated, or deleted.
 */
export function useAgentEvents({ onAgentChange, enabled = true }: UseAgentEventsOptions) {
  const callbackRef = useRef(onAgentChange)
  callbackRef.current = onAgentChange

  useEffect(() => {
    if (!enabled) return

    const es = new EventSource("/v1/events")

    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as AgentEvent
        if (event.type === "ping") return
        callbackRef.current?.(event)
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      // EventSource will auto-reconnect
    }

    return () => {
      es.close()
    }
  }, [enabled])
}
