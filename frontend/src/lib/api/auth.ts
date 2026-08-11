import i18n from "@/i18n"

import { ensureOK, langHeaders } from "./client"

export interface AuthKeyInfo {
  id: string
  name: string
  prefix: string
  /** Comma-separated scope list; "*" means full access. */
  scopes: string
  enabled: boolean
  expires_at?: string
  last_used_at?: string
  created_at: string
}

export interface AuthKeysResponse {
  enabled: boolean
  keys: AuthKeyInfo[]
  user_id?: string
}

/** Returned once on creation; `key` is the raw secret, never shown again. */
export interface CreatedAuthKey {
  id: string
  key: string
  prefix: string
  scopes: string
  expires_at?: string
}

export interface AuthUserInfo {
  id: string
  username: string
  name: string
  role: string
  created_at: string
}

export interface AuthStatusResponse {
  auth_required: boolean
  has_users: boolean
  auth_enabled?: boolean
  allow_registration: boolean
}

export interface AuthMeResponse {
  user_id: string
  key_id?: string
  password_session?: boolean
  auth_enabled?: boolean
  role?: string
  user?: AuthUserInfo
}

export interface AuthSessionResponse {
  token: string
  user_id: string
  user: AuthUserInfo
}

/** Public auth gate probe (no JWT required). */
export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  const res = await fetch("/v1/auth/status", {
    headers: { "Accept-Language": i18n.language || "zh-CN" },
  })
  if (!res.ok) {
    throw new Error(i18n.t("api.fetchAuthMeFailed", { status: res.status }))
  }
  const data = (await res.json()) as AuthStatusResponse
  return {
    auth_required: !!data.auth_required,
    has_users: !!data.has_users,
    auth_enabled: data.auth_enabled,
    allow_registration: !!data.allow_registration,
  }
}

/** Returns the current authenticated user profile. */
export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const res = await fetch("/v1/auth/me", { headers: langHeaders() })
  if (!res.ok) {
    throw new Error(i18n.t("api.fetchAuthMeFailed", { status: res.status }))
  }
  const data = (await res.json()) as AuthMeResponse
  // The role may only be present at the top level; mirror it onto the user.
  if (data.user && data.role && !data.user.role) {
    data.user = { ...data.user, role: data.role }
  }
  return data
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
    throw new Error(
      err?.details ??
        err?.message ??
        i18n.t("api.registerFailed", { status: res.status })
    )
  }
  return res.json()
}

/** Signs in with username/password and returns a login JWT. */
export async function loginUser(
  username: string,
  password: string
): Promise<AuthSessionResponse> {
  const res = await fetch("/v1/auth/login", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ username: username.trim(), password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.details ??
        err?.message ??
        i18n.t("api.loginFailed", { status: res.status })
    )
  }
  return res.json()
}

/** Lists server API keys (secrets redacted) and auth status. */
export async function fetchAuthKeys(): Promise<AuthKeysResponse> {
  const res = await fetch("/v1/auth/keys", { headers: langHeaders() })
  await ensureOK(res, "api.fetchAuthKeysFailed")
  const data = (await res.json()) as AuthKeysResponse
  return {
    enabled: !!data.enabled,
    keys: data.keys ?? [],
    user_id: data.user_id,
  }
}

/** Creates a server API key; the raw key is returned only in this response. */
export async function createAuthKey(
  name: string,
  scopes: string[],
  expiresInDays?: number
): Promise<CreatedAuthKey> {
  const res = await fetch("/v1/auth/keys", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      name: name.trim(),
      scopes,
      expires_in_days:
        expiresInDays && expiresInDays > 0 ? expiresInDays : undefined,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ?? i18n.t("api.createAuthKeyFailed", { status: res.status })
    )
  }
  return res.json()
}

/** Partial update for a server API key (name, scopes, enabled). */
export interface AuthKeyPatch {
  name?: string
  scopes?: string[]
  enabled?: boolean
}

/** Updates a server API key by id. */
export async function updateAuthKey(
  id: string,
  patch: AuthKeyPatch
): Promise<void> {
  const res = await fetch(`/v1/auth/keys/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(patch),
  })
  await ensureOK(res, "api.updateAuthKeyFailed")
}

/** Deletes a server API key by id. */
export async function deleteAuthKey(id: string): Promise<void> {
  const res = await fetch(`/v1/auth/keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: langHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ?? i18n.t("api.deleteAuthKeyFailed", { status: res.status })
    )
  }
}
