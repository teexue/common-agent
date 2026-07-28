import { useEffect, useRef, useState } from "react"
import { eventsURL, SERVER_API_KEY_CHANGED } from "@/lib/api"

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
  const [keyEpoch, setKeyEpoch] = useState(0)

  useEffect(() => {
    const onKeyChange = () => setKeyEpoch((n) => n + 1)
    window.addEventListener(SERVER_API_KEY_CHANGED, onKeyChange)
    return () => window.removeEventListener(SERVER_API_KEY_CHANGED, onKeyChange)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const es = new EventSource(eventsURL())

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
  }, [enabled, keyEpoch])
}
