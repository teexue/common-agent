import type { ConversationEntry } from "@/types/agent"

// ─── Markdown Export ──────────────────────────────────────────────

export function exportToMarkdown(entries: ConversationEntry[], agentName: string): string {
  const lines: string[] = []

  lines.push(`# 会话记录 — ${agentName}`)
  lines.push("")
  lines.push(`> 导出时间: ${new Date().toLocaleString("zh-CN")}`)
  lines.push("")

  for (const entry of entries) {
    // Skip compaction entries
    if (entry.compactionSummary) {
      lines.push("---")
      lines.push(`> ⚡ 上下文已压缩: ${entry.compactionSummary}`)
      lines.push("")
      continue
    }

    const time = new Date(entry.timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })

    if (entry.role === "user") {
      lines.push(`## 👤 你 _(${time})_`)
      lines.push("")
      lines.push(entry.content)
      lines.push("")
    }

    if (entry.role === "assistant") {
      lines.push(`## 🤖 Agent _(${time})_`)
      lines.push("")

      if (entry.reasoningContent) {
        lines.push("<details>")
        lines.push("<summary>💭 推理过程</summary>")
        lines.push("")
        lines.push(entry.reasoningContent)
        lines.push("")
        lines.push("</details>")
        lines.push("")
      }

      if (entry.toolCalls && entry.toolCalls.length > 0) {
        for (const tc of entry.toolCalls) {
          const status = tc.status === "completed" ? "✅" : tc.status === "error" ? "❌" : "⏳"
          lines.push(`### ${status} 工具: \`${tc.name}\``)
          lines.push("")
          if (tc.input) {
            lines.push("**输入:**")
            lines.push("```json")
            lines.push(JSON.stringify(tc.input, null, 2))
            lines.push("```")
            lines.push("")
          }
          if (tc.output !== undefined) {
            lines.push("**输出:**")
            lines.push("```json")
            lines.push(
              typeof tc.output === "string" ? tc.output : JSON.stringify(tc.output, null, 2)
            )
            lines.push("```")
            lines.push("")
          }
        }
      }

      if (entry.content) {
        lines.push(entry.content)
        lines.push("")
      }

      if (entry.usage) {
        lines.push(
          `_Token 用量: ${entry.usage.inputTokens.toLocaleString()} 输入 / ${entry.usage.outputTokens.toLocaleString()} 输出_`
        )
        lines.push("")
      }
    }
  }

  return lines.join("\n")
}

// ─── JSON Export ──────────────────────────────────────────────────

export function exportToJson(entries: ConversationEntry[], agentName: string): string {
  const data = {
    agent: agentName,
    exportedAt: new Date().toISOString(),
    messages: entries
      .filter((e) => !e.compactionSummary)
      .map((e) => ({
        role: e.role,
        content: e.content,
        reasoning: e.reasoningContent || undefined,
        toolCalls: e.toolCalls?.map((tc) => ({
          name: tc.name,
          input: tc.input,
          output: tc.output,
          status: tc.status,
        })),
        usage: e.usage || undefined,
        timestamp: new Date(e.timestamp).toISOString(),
      })),
  }
  return JSON.stringify(data, null, 2)
}

// ─── Download helper ──────────────────────────────────────────────

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
