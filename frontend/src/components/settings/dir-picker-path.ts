const HISTORY_KEY = "workdir-history"
const HISTORY_MAX = 8

export function basename(path: string): string {
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/)
  return parts[parts.length - 1] || path
}

export function loadWorkdirHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : []
  } catch {
    return []
  }
}

export function pushWorkdirHistory(dir: string): string[] {
  const next = [dir, ...loadWorkdirHistory().filter((d) => d !== dir)].slice(
    0,
    HISTORY_MAX
  )
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  return next
}
