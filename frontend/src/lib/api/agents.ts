import i18n from "@/i18n"
import type { AgentInfo, AgentDetail } from "@/types/agent"

import { ensureOK, langHeaders } from "./client"

// ─── Agents API ───────────────────────────────────────────────────

/** Fetches the list of all configured agents. */
export async function fetchAgents(): Promise<AgentInfo[]> {
  const res = await fetch("/v1/agents", { headers: langHeaders() })
  await ensureOK(res, "api.fetchAgentsFailed")
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
    throw new Error(
      err?.message ?? i18n.t("api.createAgentFailed", { status: res.status })
    )
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
    throw new Error(
      err?.message ?? i18n.t("api.updateAgentFailed", { status: res.status })
    )
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
    throw new Error(
      err?.message ?? i18n.t("api.deleteAgentFailed", { status: res.status })
    )
  }
}

// ─── Optimize API ────────────────────────────────────────────────

/** Options selecting which model performs the optimization. */
export interface OptimizeOptions {
  agent?: string
  kind?: "user" | "system"
  provider?: string
  model?: string
}

/** Sends a prompt to the LLM for intent recognition and optimization. */
export async function optimizePrompt(
  prompt: string,
  opts: OptimizeOptions = {}
): Promise<{ optimized_prompt: string }> {
  const res = await fetch("/v1/agents/optimize", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prompt, ...opts }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ?? i18n.t("api.optimizePromptFailed", { status: res.status })
    )
  }
  return res.json()
}
