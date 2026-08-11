/** Supported API key scopes; "*" means full access. */
export const ALL_SCOPES = [
  "agents",
  "sessions",
  "kanban",
  "knowledge",
  "skills",
  "mcp",
  "providers",
  "audit",
  "fs",
] as const

/** Accepts both comma-separated strings and arrays from the API. */
export function parseScopes(scopes: string | string[] | undefined): string[] {
  if (!scopes) return []
  const list = Array.isArray(scopes) ? scopes : scopes.split(",")
  return list.map((s) => s.trim()).filter(Boolean)
}

/** Localized scope display name; falls back to the raw scope. */
export function scopeLabel(t: (key: string) => string, scope: string): string {
  if (scope === "*") return t("settings.scopeAll")
  const key = `settings.scope${scope.charAt(0).toUpperCase()}${scope.slice(1)}`
  const label = t(key)
  return label === key ? scope : label
}
