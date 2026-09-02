import i18n from "@/i18n"
import type { SessionMeta } from "@/types/agent"

import { ensureOK, langHeaders, notifyUnauthorized } from "./client"

/** Fetches the list of all sessions. */
export async function fetchSessions(): Promise<SessionMeta[]> {
  const res = await fetch("/v1/sessions", { headers: langHeaders() })
  await ensureOK(res, "api.fetchSessionsFailed")
  return (await res.json()) ?? []
}

/** Fetches a single session by ID with its messages. */
export async function fetchSession(id: string): Promise<{
  id: string
  agent: string
  title?: string
  messages: unknown[]
  metadata: Record<string, string>
  created_at: string
  updated_at: string
}> {
  const res = await fetch(`/v1/sessions/${encodeURIComponent(id)}`, {
    headers: langHeaders(),
  })
  if (res.status === 401) {
    notifyUnauthorized()
    throw new Error(i18n.t("api.fetchSessionFailed", { status: res.status }))
  }
  if (!res.ok) {
    if (res.status === 404) throw new Error(i18n.t("api.sessionNotFound"))
    throw new Error(i18n.t("api.fetchSessionFailed", { status: res.status }))
  }
  return res.json()
}

/** Deletes a session by ID. */
export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`/v1/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: langHeaders(),
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error(i18n.t("api.sessionNotFound"))
    throw new Error(i18n.t("api.deleteSessionFailed", { status: res.status }))
  }
}

/** Sets (or clears, with an empty string) the per-session working directory. */
export async function updateSessionWorkdir(
  id: string,
  workdir: string
): Promise<Record<string, string>> {
  const res = await fetch(`/v1/sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ workdir }),
  })
  await ensureOK(res, "api.updateSessionFailed")
  const data = (await res.json()) as { metadata?: Record<string, string> }
  return data.metadata ?? {}
}

/** Asks the server to cancel an in-flight run. No-ops when nothing is running. */
export async function abortSession(id: string): Promise<boolean> {
  const res = await fetch(`/v1/sessions/${encodeURIComponent(id)}/abort`, {
    method: "POST",
    headers: langHeaders(),
  })
  if (res.status === 404) return false
  await ensureOK(res, "api.abortSessionFailed")
  const data = (await res.json()) as { aborted?: boolean }
  return !!data.aborted
}
