import i18n from "@/i18n"
import type { MetricsData, HealthStatus } from "@/types/agent"

import { langHeaders } from "./client"

// ─── Tools API ────────────────────────────────────────────────────

/** Fetches the list of registered tools with their schemas. */
export async function fetchTools(): Promise<
  Array<{
    name: string
    description: string
    parameters: Record<string, unknown>
  }>
> {
  const res = await fetch("/v1/tools", { headers: langHeaders() })
  if (!res.ok)
    throw new Error(i18n.t("api.fetchToolsFailed", { status: res.status }))
  return (await res.json()) ?? []
}

// ─── Health & Metrics API ─────────────────────────────────────────

/** Fetches Prometheus-format metrics from the server. */
export async function fetchMetrics(): Promise<MetricsData> {
  const res = await fetch("/metrics", { headers: langHeaders() })
  if (!res.ok)
    throw new Error(i18n.t("api.fetchMetricsFailed", { status: res.status }))
  return res.json()
}

/** Fetches the server health/readiness status. */
export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch("/readyz", { headers: langHeaders() })
  const data = await res.json()
  // details is a JSON-encoded string from the backend, parse it
  if (data.details && typeof data.details === "string") {
    try {
      data.details = JSON.parse(data.details)
    } catch {
      // leave as-is
    }
  }
  return data
}

// ─── Filesystem API ───────────────────────────────────────────────

export interface DirEntryInfo {
  name: string
  path: string
  is_dir: boolean
}

export interface DirListResponse {
  path: string
  parent?: string
  entries: DirEntryInfo[]
}

/** Lists directories on the remote server filesystem. */
export async function fetchDirList(path?: string): Promise<DirListResponse> {
  const params = new URLSearchParams()
  if (path) params.set("path", path)
  const qs = params.toString()
  const res = await fetch(`/v1/fs/list${qs ? `?${qs}` : ""}`, {
    headers: langHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ?? i18n.t("api.fetchDirListFailed", { status: res.status })
    )
  }
  return res.json()
}
