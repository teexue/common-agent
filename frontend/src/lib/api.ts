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
} from "@/types/agent"

// ─── Approval API ─────────────────────────────────────────────────

/** Resolves a pending tool approval request. */
export async function resolveApproval(
  approvalId: string,
  approved: Promise<boolean> | boolean
): Promise<void> {
  const res = await fetch("/v1/agents/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      approval_id: approvalId,
      approved: await approved,
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to resolve approval: ${res.status}`)
  }
}

// ─── Session API ──────────────────────────────────────────────────

/** Fetches the list of all sessions. */
export async function fetchSessions(): Promise<SessionMeta[]> {
  const res = await fetch("/v1/sessions")
  if (!res.ok) {
    throw new Error(`Failed to fetch sessions: ${res.status}`)
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
  const res = await fetch(`/v1/sessions/${encodeURIComponent(id)}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error("Session not found")
    throw new Error(`Failed to fetch session: ${res.status}`)
  }
  return res.json()
}

/** Deletes a session by ID. */
export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`/v1/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error("Session not found")
    throw new Error(`Failed to delete session: ${res.status}`)
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

  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) throw new Error("Session replay not found")
    throw new Error(`Failed to fetch session replay: ${res.status}`)
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
  const res = await fetch("/v1/agents")
  if (!res.ok) throw new Error(`Failed to fetch agents: ${res.status}`)
  return (await res.json()) ?? []
}

/** Fetches full details for a single agent by name. */
export async function fetchAgentDetail(name: string): Promise<AgentDetail> {
  const res = await fetch(`/v1/agents/${encodeURIComponent(name)}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error("Agent not found")
    throw new Error(`Failed to fetch agent: ${res.status}`)
  }
  return res.json()
}

/** Creates or updates an agent definition from YAML. */
export async function updateAgent(
  name: string,
  yaml: string
): Promise<{ status: string; name: string }> {
  const res = await fetch(`/v1/agents/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/x-yaml" },
    body: yaml,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? `Failed to update agent: ${res.status}`)
  }
  return res.json()
}

/** Validates an agent YAML definition without persisting it. */
export async function validateAgent(
  yaml: string
): Promise<{ valid: boolean; name?: string; message?: string }> {
  const res = await fetch("/v1/agents/validate", {
    method: "POST",
    headers: { "Content-Type": "application/x-yaml" },
    body: yaml,
  })
  if (!res.ok) {
    throw new Error(`Validation request failed: ${res.status}`)
  }
  return res.json()
}

/** Deletes an agent definition by name. */
export async function deleteAgent(name: string): Promise<void> {
  const res = await fetch(`/v1/agents/${encodeURIComponent(name)}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error("Agent not found")
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? `Failed to delete agent: ${res.status}`)
  }
}

// ─── Providers API ────────────────────────────────────────────────

/** Fetches the list of available LLM providers. */
export async function fetchProviders(): Promise<ProviderInfo[]> {
  const res = await fetch("/v1/providers")
  if (!res.ok) {
    throw new Error(`Failed to fetch providers: ${res.status}`)
  }
  return (await res.json()) ?? []
}

/** Fetches the list of configured MCP servers. */
export async function fetchMCPServers(): Promise<MCPServerInfo[]> {
  const res = await fetch("/v1/mcp")
  if (!res.ok) {
    throw new Error(`Failed to fetch MCP servers: ${res.status}`)
  }
  return (await res.json()) ?? []
}

/** Fetches the list of available skills. */
export async function fetchSkills(): Promise<SkillInfo[]> {
  const res = await fetch("/v1/skills")
  if (!res.ok) {
    throw new Error(`Failed to fetch skills: ${res.status}`)
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
  const res = await fetch("/v1/tools")
  if (!res.ok) throw new Error(`Failed to fetch tools: ${res.status}`)
  return (await res.json()) ?? []
}

// ─── Health & Metrics API ─────────────────────────────────────────

/** Fetches Prometheus-format metrics from the server. */
export async function fetchMetrics(): Promise<MetricsData> {
  const res = await fetch("/metrics")
  if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.status}`)
  return res.json()
}

/** Fetches the server health/readiness status. */
export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch("/readyz")
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
