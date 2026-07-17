import i18n from "@/i18n"
import type {
  AgentInfo,
  AgentDetail,
  SessionMeta,
  ReplayEvent,
  MetricsData,
  HealthStatus,
  ProviderInfo,
  MCPServerInfo,
  SkillInfo,
  JobInfo,
  JobRunRecord,
} from "@/types/agent"

function langHeaders(extra?: HeadersInit): HeadersInit {
  return { "Accept-Language": i18n.language || "zh-CN", ...extra }
}

// ─── Approval API ─────────────────────────────────────────────────

/** Resolves a pending tool approval request. */
export async function resolveApproval(
  approvalId: string,
  approved: Promise<boolean> | boolean
): Promise<void> {
  const res = await fetch("/v1/agents/approve", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      approval_id: approvalId,
      approved: await approved,
    }),
  })
  if (!res.ok) {
    throw new Error(i18n.t("api.resolveApprovalFailed", { status: res.status }))
  }
}

// ─── Session API ──────────────────────────────────────────────────

/** Fetches the list of all sessions. */
export async function fetchSessions(): Promise<SessionMeta[]> {
  const res = await fetch("/v1/sessions", { headers: langHeaders() })
  if (!res.ok) {
    throw new Error(i18n.t("api.fetchSessionsFailed", { status: res.status }))
  }
  return (await res.json()) ?? []
}

/** Fetches a single session by ID with its messages. */
export async function fetchSession(
  id: string
): Promise<{
  id: string
  agent: string
  messages: unknown[]
  metadata: Record<string, string>
  created_at: string
  updated_at: string
}> {
  const res = await fetch(`/v1/sessions/${encodeURIComponent(id)}`, {
    headers: langHeaders(),
  })
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

/** Fetches replay events for a session, optionally filtered by turn range. */
export async function fetchSessionReplay(
  id: string,
  fromTurn?: number,
  toTurn?: number
): Promise<ReplayEvent[]> {
  const params = new URLSearchParams()
  if (fromTurn !== undefined) params.set("from_turn", String(fromTurn))
  if (toTurn !== undefined) params.set("to_turn", String(toTurn))
  const qs = params.toString()
  const url = `/v1/sessions/${encodeURIComponent(id)}/replay${qs ? `?${qs}` : ""}`

  const res = await fetch(url, { headers: langHeaders() })
  if (!res.ok) {
    if (res.status === 404) throw new Error(i18n.t("api.replayNotFound"))
    throw new Error(i18n.t("api.fetchReplayFailed", { status: res.status }))
  }

  // Parse NDJSON response
  const text = await res.text()
  const events: ReplayEvent[] = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      events.push(JSON.parse(trimmed))
    } catch {
      // skip malformed lines
    }
  }
  return events
}

// ─── Agents API ───────────────────────────────────────────────────

/** Fetches the list of all configured agents. */
export async function fetchAgents(): Promise<AgentInfo[]> {
  const res = await fetch("/v1/agents", { headers: langHeaders() })
  if (!res.ok) throw new Error(i18n.t("api.fetchAgentsFailed", { status: res.status }))
  return (await res.json()) ?? []
}

/** Fetches full details for a single agent by id. */
export async function fetchAgentDetail(id: string): Promise<AgentDetail> {
  const res = await fetch(`/v1/agents/${encodeURIComponent(id)}`, {
    headers: langHeaders(),
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error(i18n.t("api.agentNotFound"))
    throw new Error(i18n.t("api.fetchAgentFailed", { status: res.status }))
  }
  return res.json()
}

/** Creates a new agent from YAML (server assigns id when omitted). */
export async function createAgent(
  yaml: string
): Promise<{ status: string; id: string; name: string }> {
  const res = await fetch("/v1/agents", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/x-yaml" }),
    body: yaml,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.createAgentFailed", { status: res.status }))
  }
  return res.json()
}

/** Updates an agent definition by id from YAML. */
export async function updateAgent(
  id: string,
  yaml: string
): Promise<{ status: string; id: string }> {
  const res = await fetch(`/v1/agents/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: langHeaders({ "Content-Type": "application/x-yaml" }),
    body: yaml,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.updateAgentFailed", { status: res.status }))
  }
  return res.json()
}

/** Validates an agent YAML definition without persisting it. */
export async function validateAgent(
  yaml: string
): Promise<{ valid: boolean; id?: string; name?: string; message?: string }> {
  const res = await fetch("/v1/agents/validate", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/x-yaml" }),
    body: yaml,
  })
  if (!res.ok) {
    throw new Error(i18n.t("api.validateFailed", { status: res.status }))
  }
  return res.json()
}

/** Deletes an agent definition by id. */
export async function deleteAgent(id: string): Promise<void> {
  const res = await fetch(`/v1/agents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: langHeaders(),
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error(i18n.t("api.agentNotFound"))
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.deleteAgentFailed", { status: res.status }))
  }
}

// ─── Providers API ────────────────────────────────────────────────

/** Fetches the list of available LLM providers. */
export async function fetchProviders(): Promise<ProviderInfo[]> {
  const res = await fetch("/v1/providers", { headers: langHeaders() })
  if (!res.ok) {
    throw new Error(i18n.t("api.fetchProvidersFailed", { status: res.status }))
  }
  return (await res.json()) ?? []
}

/** Creates or updates a provider. */
export async function upsertProvider(data: {
  name: string
  type: string
  base_url?: string
  api_key?: string
  api_key_env?: string
  api_version?: string
  default_model?: string
  vision?: boolean
}): Promise<void> {
  const res = await fetch("/v1/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...langHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? `Failed to save provider: ${res.status}`)
  }
}

/** Deletes a provider by name. */
export async function deleteProvider(name: string): Promise<void> {
  const res = await fetch(`/v1/providers/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: langHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? `Failed to delete provider: ${res.status}`)
  }
}

/** Fetches the list of configured MCP servers. */
export async function fetchMCPServers(): Promise<MCPServerInfo[]> {
  const res = await fetch("/v1/mcp", { headers: langHeaders() })
  if (!res.ok) {
    throw new Error(i18n.t("api.fetchMcpFailed", { status: res.status }))
  }
  return (await res.json()) ?? []
}

/** Fetches the list of available skills. */
export async function fetchSkills(): Promise<SkillInfo[]> {
  const res = await fetch("/v1/skills", { headers: langHeaders() })
  if (!res.ok) {
    throw new Error(i18n.t("api.fetchSkillsFailed", { status: res.status }))
  }
  return (await res.json()) ?? []
}

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
  if (!res.ok) throw new Error(i18n.t("api.fetchToolsFailed", { status: res.status }))
  return (await res.json()) ?? []
}

// ─── Optimize API ────────────────────────────────────────────────

/** Sends a prompt to the LLM for intent recognition and optimization. */
export async function optimizePrompt(
  prompt: string,
  agent?: string
): Promise<{ optimized_prompt: string }> {
  const res = await fetch("/v1/agents/optimize", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prompt, agent }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ?? i18n.t("api.optimizePromptFailed", { status: res.status })
    )
  }
  return res.json()
}

// ─── Health & Metrics API ─────────────────────────────────────────

/** Fetches Prometheus-format metrics from the server. */
export async function fetchMetrics(): Promise<MetricsData> {
  const res = await fetch("/metrics", { headers: langHeaders() })
  if (!res.ok) throw new Error(i18n.t("api.fetchMetricsFailed", { status: res.status }))
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
  const res = await fetch(`/v1/fs/list${qs ? `?${qs}` : ""}`, { headers: langHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.fetchDirListFailed", { status: res.status }))
  }
  return res.json()
}

// ─── Jobs API ─────────────────────────────────────────────────────

/** Lists all scheduled jobs. */
export async function fetchJobs(): Promise<JobInfo[]> {
  const res = await fetch("/v1/jobs", { headers: langHeaders() })
  if (!res.ok) throw new Error(i18n.t("api.fetchJobsFailed", { status: res.status }))
  return (await res.json()) ?? []
}

/** Creates a job. */
export async function createJob(data: {
  name: string
  agent: string
  prompt: string
  workdir?: string
  schedule: { type: string; cron?: string; interval?: string }
  session_mode?: string
  enabled?: boolean
}): Promise<JobInfo> {
  const res = await fetch("/v1/jobs", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.createJobFailed", { status: res.status }))
  }
  return res.json()
}

/** Pauses a job. */
export async function pauseJob(id: string): Promise<JobInfo> {
  const res = await fetch(`/v1/jobs/${encodeURIComponent(id)}/pause`, {
    method: "POST",
    headers: langHeaders(),
  })
  if (!res.ok) throw new Error(i18n.t("api.pauseJobFailed", { status: res.status }))
  return res.json()
}

/** Resumes a job. */
export async function resumeJob(id: string): Promise<JobInfo> {
  const res = await fetch(`/v1/jobs/${encodeURIComponent(id)}/resume`, {
    method: "POST",
    headers: langHeaders(),
  })
  if (!res.ok) throw new Error(i18n.t("api.resumeJobFailed", { status: res.status }))
  return res.json()
}

/** Triggers a job run immediately. */
export async function runJobNow(id: string): Promise<void> {
  const res = await fetch(`/v1/jobs/${encodeURIComponent(id)}/run`, {
    method: "POST",
    headers: langHeaders(),
  })
  if (!res.ok) throw new Error(i18n.t("api.runJobFailed", { status: res.status }))
}

/** Deletes a job. */
export async function deleteJob(id: string): Promise<void> {
  const res = await fetch(`/v1/jobs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: langHeaders(),
  })
  if (!res.ok) throw new Error(i18n.t("api.deleteJobFailed", { status: res.status }))
}

/** Lists recent runs for a job. */
export async function fetchJobRuns(id: string): Promise<JobRunRecord[]> {
  const res = await fetch(`/v1/jobs/${encodeURIComponent(id)}/runs`, { headers: langHeaders() })
  if (!res.ok) throw new Error(i18n.t("api.fetchJobRunsFailed", { status: res.status }))
  return (await res.json()) ?? []
}
