import { useEffect, useState } from "react"
import { fetchSession } from "@/lib/api"
import { fromBackendMessages, type BackendMsg } from "@/hooks/use-chat-messages"
import type { ConversationEntry } from "@/types/agent"

export interface SessionTranscript {
  id: string
  agent: string
  title?: string
  metadata?: Record<string, string>
}

/** Loads a session transcript and optionally polls while the page is open. */
export function useSessionTranscript(sessionId: string, live: boolean) {
  const [session, setSession] = useState<SessionTranscript | null>(null)
  const [messages, setMessages] = useState<ConversationEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    const load = () =>
      fetchSession(sessionId)
        .then((sess) => {
          if (cancelled) return
          setSession({
            id: sess.id,
            agent: sess.agent,
            title: sess.title,
            metadata: sess.metadata,
          })
          setMessages(
            fromBackendMessages((sess.messages ?? []) as BackendMsg[])
          )
          setError(null)
        })
        .catch((e: unknown) => {
          if (cancelled) return
          setError(e instanceof Error ? e.message : String(e))
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
  return { session, messages, error }
}
