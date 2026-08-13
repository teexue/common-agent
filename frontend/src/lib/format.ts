import i18n from "@/i18n"

function dateLocale(): string {
  return i18n.language?.startsWith("zh") ? "zh-CN" : "en"
}

export function formatJson(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString(dateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + "..."
}

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English, ~2 for CJK
  return Math.ceil(text.length / 3)
}

/**
 * Formats a token count with the largest suitable unit (M > K).
 * e.g. 1234567 → "1.2M", 12345 → "12.3K", 123 → "123".
 */
export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return `${v >= 100 ? Math.round(v) : v.toFixed(1)}M`
  }
  if (n >= 1_000) {
    const v = n / 1_000
    return `${v >= 100 ? Math.round(v) : v.toFixed(1)}K`
  }
  return String(n)
}

/**
 * Percentage of input tokens served from the prompt cache.
 * Cache-hit tokens count towards total input, so the share is
 * cached / (cached + fresh). Returns 0 when there is no input at all.
 */
export function cacheHitPercent(
  cachedTokens: number,
  freshTokens: number
): number {
  const total = cachedTokens + freshTokens
  if (total <= 0) return 0
  return Math.round((cachedTokens / total) * 100)
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return i18n.t("format.justNow")
  if (diffMin < 60) return i18n.t("format.minutesAgo", { count: diffMin })
  if (diffHour < 24) return i18n.t("format.hoursAgo", { count: diffHour })
  if (diffDay < 7) return i18n.t("format.daysAgo", { count: diffDay })

  return date.toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
  })
}
