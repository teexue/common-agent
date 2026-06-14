import type { AgentInfo, SessionMeta } from "@/types/agent"

// ─── Approval API ─────────────────────────────────────────────────

export async function resolveApproval(approvalId: string, approved: Promise<boolean> | boolean): Promise<void> {
  const res = await fetch("/v1/agents/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approval_id: approvalId, approved: await approved }),
  })
  if (!res.ok) {
    throw new Error(`Failed to resolve approval: ${res.status}`)
  }
}

// ─── Session API ──────────────────────────────────────────────────

export async function fetchSessions(): Promise<SessionMeta[]> {
  const res = await fetch("/v1/sessions")
  if (!res.ok) {
    throw new Error(`Failed to fetch sessions: ${res.status}`)
  }
  return res.json()
}

export async function fetchSession(id: string): Promise<{
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

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`/v1/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error("Session not found")
    throw new Error(`Failed to delete session: ${res.status}`)
  }
}

// ─── Agents API ───────────────────────────────────────────────────

export async function fetchAgents(): Promise<AgentInfo[]> {
  const res = await fetch("/v1/agents")
  if (!res.ok) throw new Error(`Failed to fetch agents: ${res.status}`)
  return res.json()
}

// ─── Agent Detail API ─────────────────────────────────────────────

export async function fetchAgent(name: string): Promise<{
  name: string
  provider: string
  model: string
  system_prompt: string
  tools: string[]
  max_turns: number
  max_tokens: number
}> {
  const res = await fetch(`/v1/agents/${encodeURIComponent(name)}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error("Agent not found")
    throw new Error(`Failed to fetch agent: ${res.status}`)
  }
  return res.json()
}

// ─── Tools API ────────────────────────────────────────────────────

export async function fetchTools(): Promise<Array<{
  name: string
  description: string
  parameters: Record<string, unknown>
}>> {
  const res = await fetch("/v1/tools")
  if (!res.ok) throw new Error(`Failed to fetch tools: ${res.status}`)
  return res.json()
}
