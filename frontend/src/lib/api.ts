import i18n from "@/i18n"
import type {
  AgentInfo,
  AgentDetail,
  SessionMeta,
  ReplayEvent,
  MetricsData,
  HealthStatus,
  ProviderInfo,
  VendorInfo,
  ModelInfo,
  MCPServerInfo,
  SkillInfo,
  SkillDetail,
  JobInfo,
  JobRunRecord,
  EmbeddingConfig,
  EmbeddingVendorInfo,
  KnowledgeDocument,
  KnowledgeHit,
  KnowledgeMeta,
} from "@/types/agent"

const ACCESS_TOKEN_STORAGE = "serverAccessToken"
const LEGACY_API_KEY_STORAGE = "serverApiKey"

/** Fired on window when the access token changes (same-tab). */
export const SERVER_API_KEY_CHANGED = "server-api-key-changed"

/** Returns the JWT used for /v1/ requests. */
export function getAccessToken(): string {
  try {
    return localStorage.getItem(ACCESS_TOKEN_STORAGE) || ""
  } catch {
    return ""
  }
}

/** Persists the JWT used for /v1/ requests. */
export function setAccessToken(token: string): void {
  try {
    const trimmed = token.trim()
    if (trimmed) localStorage.setItem(ACCESS_TOKEN_STORAGE, trimmed)
    else localStorage.removeItem(ACCESS_TOKEN_STORAGE)
    localStorage.removeItem(LEGACY_API_KEY_STORAGE)
    window.dispatchEvent(new Event(SERVER_API_KEY_CHANGED))
  } catch {
    // ignore quota / private mode errors
  }
}

/** @deprecated use getAccessToken */
export function getServerApiKey(): string {
  return getAccessToken()
}

/** @deprecated use setAccessToken */
export function setServerApiKey(key: string): void {
  setAccessToken(key)
}

/** Builds an EventSource URL with optional access_token query. */
export function eventsURL(): string {
  const token = getAccessToken()
  if (!token) return "/v1/events"
  return `/v1/events?access_token=${encodeURIComponent(token)}`
}

/** Shared request headers: Accept-Language + optional Bearer JWT. */
export function apiHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    "Accept-Language": i18n.language || "zh-CN",
  }
  const token = getAccessToken()
  if (token) headers["Authorization"] = `Bearer ${token}`
  return { ...headers, ...extra }
}

function langHeaders(extra?: HeadersInit): HeadersInit {
  return apiHeaders(extra)
}

/** Handles 401 by clearing the session and notifying AuthProvider. */
export function notifyUnauthorized(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE)
    localStorage.removeItem(LEGACY_API_KEY_STORAGE)
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event("auth:unauthorized"))
}

async function ensureOK(res: Response, fallbackKey: string): Promise<void> {
  if (res.status === 401) {
    notifyUnauthorized()
    throw new Error(i18n.t(fallbackKey, { status: res.status }))
  }
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.details ?? err?.message ?? i18n.t(fallbackKey, { status: res.status }))
  }
}

/** Generates a random API key in the browser (never shown after submit). */
export function generateClientAPIKey(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `ca_${hex}`
}

export interface AuthKeyInfo {
  id: string
  name: string
  prefix: string
  created_at: string
}

export interface AuthKeysResponse {
  enabled: boolean
  keys: AuthKeyInfo[]
  user_id?: string
}

export interface CreatedAuthKey {
  id: string
  name: string
  prefix: string
  token: string
  user_id: string
  created_at: string
}

export interface AuthUserInfo {
  id: string
  username: string
  name: string
  created_at: string
}

export interface AuthStatusResponse {
  auth_required: boolean
  has_users: boolean
}

export interface AuthMeResponse {
  user_id: string
  key_id?: string
  password_session?: boolean
  auth_enabled?: boolean
  user?: AuthUserInfo
}

export interface AuthSessionResponse {
  token: string
  user_id: string
  user: AuthUserInfo
}

/** Public auth gate probe (no JWT required). */
export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  const res = await fetch("/v1/auth/status", { headers: { "Accept-Language": i18n.language || "zh-CN" } })
  if (!res.ok) {
    throw new Error(i18n.t("api.fetchAuthMeFailed", { status: res.status }))
  }
  const data = (await res.json()) as AuthStatusResponse
  return { auth_required: !!data.auth_required, has_users: !!data.has_users }
}

/** Returns the current authenticated user profile. */
export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const res = await fetch("/v1/auth/me", { headers: langHeaders() })
  if (!res.ok) {
    throw new Error(i18n.t("api.fetchAuthMeFailed", { status: res.status }))
  }
  return res.json()
}

/** Registers a new user and returns a login JWT. */
export async function registerUser(
  username: string,
  password: string,
  name?: string
): Promise<AuthSessionResponse> {
  const res = await fetch("/v1/auth/register", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      username: username.trim(),
      password,
      name: name?.trim() || undefined,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.details ?? err?.message ?? i18n.t("api.registerFailed", { status: res.status }))
  }
  return res.json()
}

/** Signs in with username/password and returns a login JWT. */
export async function loginUser(username: string, password: string): Promise<AuthSessionResponse> {
  const res = await fetch("/v1/auth/login", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ username: username.trim(), password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.details ?? err?.message ?? i18n.t("api.loginFailed", { status: res.status }))
  }
  return res.json()
}

/** Lists server API keys (secrets redacted) and auth status. */
export async function fetchAuthKeys(): Promise<AuthKeysResponse> {
  const res = await fetch("/v1/auth/keys", { headers: langHeaders() })
  await ensureOK(res, "api.fetchAuthKeysFailed")
  const data = (await res.json()) as AuthKeysResponse
  return { enabled: !!data.enabled, keys: data.keys ?? [], user_id: data.user_id }
}

/** Creates a server API key from a client-generated secret; returns JWT only. */
export async function createAuthKey(name: string, key: string): Promise<CreatedAuthKey> {
  const res = await fetch("/v1/auth/keys", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name: name.trim(), key }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.createAuthKeyFailed", { status: res.status }))
  }
  return res.json()
}

/** Deletes a server API key by id. */
export async function deleteAuthKey(id: string): Promise<void> {
  const res = await fetch(`/v1/auth/keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: langHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.deleteAuthKeyFailed", { status: res.status }))
  }
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
  await ensureOK(res, "api.fetchSessionsFailed")
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
  if (res.status === 401) {
    notifyUnauthorized()
    throw new Error(i18n.t("api.fetchSessionFailed", { status: res.status }))
  }
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

/** Sets (or clears, with an empty string) the per-session working directory. */
export async function updateSessionWorkdir(
  id: string,
  workdir: string
): Promise<Record<string, string>> {
  const res = await fetch(`/v1/sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ workdir }),
  })
  await ensureOK(res, "api.updateSessionFailed")
  const data = (await res.json()) as { metadata?: Record<string, string> }
  return data.metadata ?? {}
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
    throw new Error((err?.message ?? i18n.t("api.fetchModelsFailed", { status: res.status })) + detail)
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
    throw new Error(err?.message ?? i18n.t("api.saveMcpFailed", { status: res.status }))
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
    throw new Error(err?.message ?? i18n.t("api.deleteMcpFailed", { status: res.status }))
  }
}

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
    throw new Error(err?.message ?? i18n.t("api.fetchSkillFailed", { status: res.status }))
  }
  return res.json()
}

/** Creates a new skill; 409 when one with the same name exists in the scope. */
export async function createSkill(data: SkillPayload): Promise<{ ok: boolean; skill: SkillInfo }> {
  const res = await fetch("/v1/skills", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.details ?? err?.message ?? i18n.t("api.createSkillFailed", { status: res.status }))
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
    throw new Error(err?.details ?? err?.message ?? i18n.t("api.updateSkillFailed", { status: res.status }))
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
    throw new Error(err?.message ?? i18n.t("api.deleteSkillFailed", { status: res.status }))
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
    throw new Error(err?.details ?? err?.message ?? i18n.t("api.installSkillFailed", { status: res.status }))
  }
  return res.json()
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

// ─── Knowledge API ────────────────────────────────────────────────

/** Lists knowledge bases. */
export async function fetchKnowledgeBases(): Promise<KnowledgeMeta[]> {
  const res = await fetch("/v1/knowledge", { headers: langHeaders() })
  if (!res.ok) throw new Error(i18n.t("api.fetchKnowledgeFailed", { status: res.status }))
  const data = await res.json()
  return data?.bases ?? []
}

/** Creates a knowledge base. */
export async function createKnowledgeBase(data: {
  id: string
  name: string
  description?: string
}): Promise<KnowledgeMeta> {
  const res = await fetch("/v1/knowledge", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.createKnowledgeFailed", { status: res.status }))
  }
  return res.json()
}

/** Fetches one knowledge base. */
export async function fetchKnowledgeBase(id: string): Promise<KnowledgeMeta> {
  const res = await fetch(`/v1/knowledge/${encodeURIComponent(id)}`, { headers: langHeaders() })
  if (!res.ok) throw new Error(i18n.t("api.fetchKnowledgeFailed", { status: res.status }))
  return res.json()
}

/** Updates knowledge base metadata. */
export async function updateKnowledgeBase(
  id: string,
  data: { name?: string; description?: string }
): Promise<KnowledgeMeta> {
  const res = await fetch(`/v1/knowledge/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.updateKnowledgeFailed", { status: res.status }))
  }
  return res.json()
}

/** Deletes a knowledge base. */
export async function deleteKnowledgeBase(id: string): Promise<void> {
  const res = await fetch(`/v1/knowledge/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: langHeaders(),
  })
  if (!res.ok) throw new Error(i18n.t("api.deleteKnowledgeFailed", { status: res.status }))
}

/** Lists documents in a knowledge base. */
export async function fetchKnowledgeDocuments(kbId: string): Promise<KnowledgeDocument[]> {
  const res = await fetch(`/v1/knowledge/${encodeURIComponent(kbId)}/documents`, {
    headers: langHeaders(),
  })
  if (!res.ok) throw new Error(i18n.t("api.fetchKnowledgeDocsFailed", { status: res.status }))
  const data = await res.json()
  return data?.documents ?? []
}

/** Uploads a document into a knowledge base. */
export async function uploadKnowledgeDocument(
  kbId: string,
  file: File
): Promise<KnowledgeDocument> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`/v1/knowledge/${encodeURIComponent(kbId)}/documents`, {
    method: "POST",
    headers: langHeaders(),
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.uploadKnowledgeDocFailed", { status: res.status }))
  }
  return res.json()
}

/** Deletes a document from a knowledge base. */
export async function deleteKnowledgeDocument(kbId: string, docId: string): Promise<void> {
  const res = await fetch(
    `/v1/knowledge/${encodeURIComponent(kbId)}/documents/${encodeURIComponent(docId)}`,
    { method: "DELETE", headers: langHeaders() }
  )
  if (!res.ok) throw new Error(i18n.t("api.deleteKnowledgeDocFailed", { status: res.status }))
}

/** Rebuilds the vector index for a knowledge base. */
export async function reindexKnowledgeBase(kbId: string): Promise<void> {
  const res = await fetch(`/v1/knowledge/${encodeURIComponent(kbId)}/reindex`, {
    method: "POST",
    headers: langHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.reindexKnowledgeFailed", { status: res.status }))
  }
}

/** Runs an admin search against knowledge bases. */
export async function searchKnowledge(data: {
  query: string
  kb_ids?: string[]
  top_k?: number
}): Promise<KnowledgeHit[]> {
  const res = await fetch("/v1/knowledge/search", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.searchKnowledgeFailed", { status: res.status }))
  }
  const body = await res.json()
  return body?.hits ?? []
}

/** Fetches embedding settings. */
export async function fetchEmbeddingConfig(): Promise<EmbeddingConfig> {
  const res = await fetch("/v1/embedding", { headers: langHeaders() })
  if (!res.ok) throw new Error(i18n.t("api.fetchEmbeddingFailed", { status: res.status }))
  return res.json()
}

/** Lists built-in embedding vendors. */
export async function fetchEmbeddingVendors(): Promise<EmbeddingVendorInfo[]> {
  const res = await fetch("/v1/embedding/vendors", { headers: langHeaders() })
  if (!res.ok) throw new Error(i18n.t("api.fetchEmbeddingVendorsFailed", { status: res.status }))
  return (await res.json()) ?? []
}

/** Saves embedding settings. */
export async function saveEmbeddingConfig(cfg: {
  vendor?: string
  backend: string
  base_url?: string
  api_key_env?: string
  model: string
  dimensions?: number
  api_key?: string
}): Promise<EmbeddingConfig> {
  const res = await fetch("/v1/embedding", {
    method: "PUT",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(cfg),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.saveEmbeddingFailed", { status: res.status }))
  }
  return res.json()
}
