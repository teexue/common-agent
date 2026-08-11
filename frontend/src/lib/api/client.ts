import i18n from "@/i18n"

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

/** Alias of apiHeaders shared by the domain modules. */
export function langHeaders(extra?: HeadersInit): HeadersInit {
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

/** Throws a localized error for non-OK responses; handles 401. */
export async function ensureOK(
  res: Response,
  fallbackKey: string
): Promise<void> {
  if (res.status === 401) {
    notifyUnauthorized()
    throw new Error(i18n.t(fallbackKey, { status: res.status }))
  }
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.details ??
        err?.message ??
        i18n.t(fallbackKey, { status: res.status })
    )
  }
}

/**
 * @deprecated Keys are generated server-side; no longer used.
 * Generates a random API key in the browser (never shown after submit).
 */
export function generateClientAPIKey(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `ca_${hex}`
}
