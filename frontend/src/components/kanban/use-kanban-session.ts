import { useEffect, useState } from "react"
import { fetchSession } from "@/lib/api"
import { fromBackendMessages, type BackendMsg } from "@/hooks/use-chat-messages"
import type { ConversationEntry } from "@/types/agent"

/** Loads a kanban run's session transcript; polls while the item is running. */
export function useKanbanSession(
  sessionId: string | undefined,
  live: boolean
): ConversationEntry[] {
  const [messages, setMessages] = useState<ConversationEntry[]>([])
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    const load = () =>
      fetchSession(sessionId)
        .then((sess) => {
          if (cancelled) return
          setMessages(
            fromBackendMessages((sess.messages ?? []) as BackendMsg[])
          )
        })
        .catch(() => {
          if (!cancelled) setMessages([])
        })
    void load()
    if (!live)
      return () => {
        cancelled = true
      }
    const timer = window.setInterval(() => void load(), 2_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [sessionId, live])
  return sessionId ? messages : []
}
