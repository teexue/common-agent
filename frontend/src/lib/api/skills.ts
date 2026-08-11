import i18n from "@/i18n"
import type { SkillInfo, SkillDetail } from "@/types/agent"

import { langHeaders } from "./client"

/** Fetches the list of available skills. */
export async function fetchSkills(): Promise<SkillInfo[]> {
  const res = await fetch("/v1/skills", { headers: langHeaders() })
  if (!res.ok) {
    throw new Error(i18n.t("api.fetchSkillsFailed", { status: res.status }))
  }
  return (await res.json()) ?? []
}

/** Payload for creating or updating a skill. */
export interface SkillPayload {
  name: string
  description: string
  body: string
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  allowed_tools?: string
  scope: "global" | "agent"
  agent?: string
}

function skillScopeQuery(scope: "global" | "agent", agent?: string): string {
  const params = new URLSearchParams({ scope })
  if (scope === "agent" && agent) params.set("agent", agent)
  return `?${params.toString()}`
}

/** Fetches full details for a single skill. */
export async function fetchSkill(
  name: string,
  scope: "global" | "agent",
  agent?: string
): Promise<SkillDetail> {
  const res = await fetch(
    `/v1/skills/${encodeURIComponent(name)}${skillScopeQuery(scope, agent)}`,
    { headers: langHeaders() }
  )
  if (!res.ok) {
    if (res.status === 404) throw new Error(i18n.t("api.skillNotFound"))
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ?? i18n.t("api.fetchSkillFailed", { status: res.status })
    )
  }
  return res.json()
}

/** Creates a new skill; 409 when one with the same name exists in the scope. */
export async function createSkill(
  data: SkillPayload
): Promise<{ ok: boolean; skill: SkillInfo }> {
  const res = await fetch("/v1/skills", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.details ??
        err?.message ??
        i18n.t("api.createSkillFailed", { status: res.status })
    )
  }
  return res.json()
}

/** Updates an existing skill (path name wins over body name). */
export async function updateSkill(
  name: string,
  data: SkillPayload
): Promise<{ ok: boolean; skill: SkillInfo }> {
  const res = await fetch(`/v1/skills/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.details ??
        err?.message ??
        i18n.t("api.updateSkillFailed", { status: res.status })
    )
  }
  return res.json()
}

/** Deletes a skill by name within the given scope. */
export async function deleteSkill(
  name: string,
  scope: "global" | "agent",
  agent?: string
): Promise<void> {
  const res = await fetch(
    `/v1/skills/${encodeURIComponent(name)}${skillScopeQuery(scope, agent)}`,
    { method: "DELETE", headers: langHeaders() }
  )
  if (!res.ok) {
    if (res.status === 404) throw new Error(i18n.t("api.skillNotFound"))
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ?? i18n.t("api.deleteSkillFailed", { status: res.status })
    )
  }
}

/** Installs skills from a remote URL (repo or SKILL.md link). */
export async function installSkill(data: {
  url: string
  scope: "global" | "agent"
  agent?: string
  overwrite?: boolean
}): Promise<{ installed: string[] }> {
  const res = await fetch("/v1/skills/install", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.details ??
        err?.message ??
        i18n.t("api.installSkillFailed", { status: res.status })
    )
  }
  return res.json()
}
