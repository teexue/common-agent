import i18n from "@/i18n"
import type {
  ProviderInfo,
  VendorInfo,
  ModelInfo,
  MCPServerInfo,
} from "@/types/agent"

import { langHeaders } from "./client"

// ─── Providers API ────────────────────────────────────────────────

/** Fetches the list of available LLM providers. */
export async function fetchProviders(): Promise<ProviderInfo[]> {
  const res = await fetch("/v1/providers", { headers: langHeaders() })
  if (!res.ok) {
    throw new Error(i18n.t("api.fetchProvidersFailed", { status: res.status }))
  }
  return (await res.json()) ?? []
}

/** Fetches the built-in vendor presets (no secrets). */
export async function fetchVendors(): Promise<VendorInfo[]> {
  const res = await fetch("/v1/vendors", { headers: langHeaders() })
  if (!res.ok) {
    throw new Error(i18n.t("api.fetchVendorsFailed", { status: res.status }))
  }
  return (await res.json()) ?? []
}

/** Fetches the model list using inline provider config (no saved provider required).
 *  Lets the UI pull models while creating a provider before saving it. */
export async function fetchProviderModels(opts: {
  name?: string
  api_style: string
  base_url?: string
  models_path?: string
  api_version?: string
  auth_style?: string
  api_key?: string
}): Promise<ModelInfo[]> {
  const res = await fetch("/v1/providers/models", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...langHeaders() },
    body: JSON.stringify(opts),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    const detail = err?.details ? `: ${err.details}` : ""
    throw new Error(
      (err?.message ??
        i18n.t("api.fetchModelsFailed", { status: res.status })) + detail
    )
  }
  return (await res.json()) ?? []
}

/** Creates or updates a provider. */
export async function upsertProvider(data: {
  name: string
  api_style: string
  base_url?: string
  api_key?: string
  api_key_env?: string
  api_version?: string
  auth_style?: string
  default_model?: string
  display_name?: string
  models_path?: string
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

/** Fetches the list of configured MCP servers (global + per-agent). */
export async function fetchMCPServers(): Promise<MCPServerInfo[]> {
  const res = await fetch("/v1/mcp", { headers: langHeaders() })
  if (!res.ok) {
    throw new Error(i18n.t("api.fetchMcpFailed", { status: res.status }))
  }
  return (await res.json()) ?? []
}

/** Upserts a global shared MCP server by name. */
export async function upsertGlobalMCP(data: {
  name: string
  type: "stdio" | "sse"
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
}): Promise<void> {
  const res = await fetch("/v1/mcp/global", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ?? i18n.t("api.saveMcpFailed", { status: res.status })
    )
  }
}

/** Deletes a global shared MCP server by name. */
export async function deleteGlobalMCP(name: string): Promise<void> {
  const res = await fetch(`/v1/mcp/global/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: langHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ?? i18n.t("api.deleteMcpFailed", { status: res.status })
    )
  }
}
