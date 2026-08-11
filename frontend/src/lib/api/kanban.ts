import i18n from "@/i18n"
import type { KanbanItem } from "@/types/agent"

import { ensureOK, langHeaders } from "./client"

// ─── Kanban API ───────────────────────────────────────────────────

/** Lists all kanban items. */
export async function fetchKanbanItems(): Promise<KanbanItem[]> {
  const res = await fetch("/v1/kanban", { headers: langHeaders() })
  await ensureOK(res, "api.fetchKanbanFailed")
  return (await res.json()) ?? []
}

/** Payload for creating a kanban item. */
export interface KanbanCreatePayload {
  title: string
  prompt: string
  agent: string
  workdir?: string
  priority?: number
  tags?: string[]
  due_at?: string
}

/** Creates a kanban item. */
export async function createKanbanItem(
  data: KanbanCreatePayload
): Promise<KanbanItem> {
  const res = await fetch("/v1/kanban", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ?? i18n.t("api.createKanbanFailed", { status: res.status })
    )
  }
  return res.json()
}

/** Updates a kanban item with a subset of editable fields. */
export async function updateKanbanItem(
  id: string,
  data: Partial<KanbanCreatePayload & { status: string }>
): Promise<KanbanItem> {
  const res = await fetch(`/v1/kanban/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ?? i18n.t("api.updateKanbanFailed", { status: res.status })
    )
  }
  return res.json()
}

/** Deletes a kanban item. */
export async function deleteKanbanItem(id: string): Promise<void> {
  const res = await fetch(`/v1/kanban/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: langHeaders(),
  })
  if (!res.ok)
    throw new Error(i18n.t("api.deleteKanbanFailed", { status: res.status }))
}

/** Approves a kanban item in review (review → done). */
export async function approveKanbanItem(id: string): Promise<KanbanItem> {
  const res = await fetch(`/v1/kanban/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: langHeaders(),
  })
  if (!res.ok)
    throw new Error(i18n.t("api.approveKanbanFailed", { status: res.status }))
  return res.json()
}

/** Rejects a kanban item in review with feedback (review → pending). */
export async function rejectKanbanItem(
  id: string,
  feedback: string
): Promise<KanbanItem> {
  const res = await fetch(`/v1/kanban/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ feedback }),
  })
  if (!res.ok)
    throw new Error(i18n.t("api.rejectKanbanFailed", { status: res.status }))
  return res.json()
}

/** Requeues a failed kanban item (failed → pending). */
export async function requeueKanbanItem(id: string): Promise<KanbanItem> {
  const res = await fetch(`/v1/kanban/${encodeURIComponent(id)}/requeue`, {
    method: "POST",
    headers: langHeaders(),
  })
  if (!res.ok)
    throw new Error(i18n.t("api.requeueKanbanFailed", { status: res.status }))
  return res.json()
}
