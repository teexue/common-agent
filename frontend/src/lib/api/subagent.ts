import { ensureOK, langHeaders } from "./client"

export interface SubagentSettings {
  enabled: boolean
  max_turns: number
  timeout: number
}

/** Fetches global sub-agent limits. */
export async function fetchSubagentSettings(): Promise<SubagentSettings> {
  const res = await fetch("/v1/subagent", { headers: langHeaders() })
  await ensureOK(res, "api.fetchSubagentFailed")
  return res.json()
}

/** Saves global sub-agent limits (admin). */
export async function saveSubagentSettings(
  cfg: SubagentSettings
): Promise<SubagentSettings> {
  const res = await fetch("/v1/subagent", {
    method: "PUT",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(cfg),
  })
  await ensureOK(res, "api.saveSubagentFailed")
  return res.json()
}
