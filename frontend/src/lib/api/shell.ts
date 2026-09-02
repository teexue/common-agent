import { ensureOK, langHeaders } from "./client"

export interface ShellInfo {
  id: string
  name: string
  path: string
}

export interface ShellSettings {
  os: string
  selectable: boolean
  shell: string
  resolved: ShellInfo
  available: ShellInfo[]
}

/** Fetches command-terminal settings and detected shells. */
export async function fetchShellSettings(): Promise<ShellSettings> {
  const res = await fetch("/v1/shell", { headers: langHeaders() })
  await ensureOK(res, "api.fetchShellFailed")
  return res.json()
}

/** Saves the preferred command terminal (admin). */
export async function saveShellSettings(shell: string): Promise<ShellSettings> {
  const res = await fetch("/v1/shell", {
    method: "PUT",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ shell }),
  })
  await ensureOK(res, "api.saveShellFailed")
  return res.json()
}
