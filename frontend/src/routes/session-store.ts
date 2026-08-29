import { useCallback, useEffect, useState } from "react"
import { deleteSession, fetchSessions } from "@/lib/api"
import type { SessionMeta } from "@/types/agent"

/**
 * Module-level session list shared by every route, so the sidebar keeps one
 * copy of the data for the whole SPA lifetime instead of refetching on each
 * page change. The workspace pushes live run state in via setSessionRunning
 * so the sidebar can badge sessions with a run in progress.
 */
let globalSessions: SessionMeta[] = []
/** Session ids with a run currently in progress (workspace-known). */
const runningSessions = new Set<string>()
type Listener = (sessions: SessionMeta[]) => void
const listeners = new Set<Listener>()
let pollTimer: number | null = null
let fastTimer: number | null = null

function emit() {
  globalSessions = globalSessions.map((s) =>
    runningSessions.has(s.id) ? { ...s, running: true } : s
  )
  const snapshot = globalSessions
  for (const listener of listeners) listener(snapshot)
}

/** Background refetch so kanban runs / other tabs appear without navigation. */
function fetchAndUpdate() {
  return fetchSessions()
    .then((d) => {
      globalSessions = d ?? []
      emit()
    })
    .catch(() => {})
}

/** Polls at `ms` intervals; no-op when a same-speed timer already runs. */
function ensurePolling(ms: number) {
  if (ms === 2_000) {
    if (fastTimer !== null) return
    fastTimer = window.setInterval(() => void fetchAndUpdate(), ms)
    return
  }
  if (pollTimer !== null) return
  pollTimer = window.setInterval(() => void fetchAndUpdate(), ms)
}

function stopSlowPolling() {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

function stopFastPolling() {
  if (fastTimer !== null) {
    window.clearInterval(fastTimer)
    fastTimer = null
  }
}

/** Subscribes a component to the global session list. Fetches fresh data on
 * first mount; later mounts reuse the shared list and poll in background. */
export function useSessionStore() {
  const [sessions, setSessions] = useState<SessionMeta[]>(globalSessions)

  useEffect(() => {
    listeners.add(setSessions as Listener)
    void fetchAndUpdate()
    if (runningSessions.size > 0) ensurePolling(2_000)
    else ensurePolling(10_000)
    return () => {
      listeners.delete(setSessions as Listener)
      if (listeners.size === 0) {
        stopSlowPolling()
        stopFastPolling()
      }
    }
  }, [])

  const refresh = useCallback(() => fetchAndUpdate(), [])

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteSession(id)
        runningSessions.delete(id)
        await refresh()
      } catch (err) {
        console.error("Failed to delete session:", err)
      }
    },
    [refresh]
  )

  return { sessions, refresh, remove }
}

/** Marks a session as having / not having a run in progress. */
export function setSessionRunning(sessionId: string | null, running: boolean) {
  if (!sessionId) return
  const changed = running
    ? !runningSessions.has(sessionId)
    : runningSessions.delete(sessionId)
  if (!changed) return
  if (running) runningSessions.add(sessionId)
  emit()
  if (runningSessions.size > 0) {
    stopSlowPolling()
    ensurePolling(2_000)
  } else {
    stopFastPolling()
    if (listeners.size > 0) ensurePolling(10_000)
  }
}
