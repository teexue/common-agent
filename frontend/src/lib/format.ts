export function formatJson(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", {
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

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return "刚刚"
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHour < 24) return `${diffHour} 小时前`
  if (diffDay < 7) return `${diffDay} 天前`

  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  })
}
