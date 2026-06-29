import type { ConversationEntry } from "@/types/agent"

// ─── Markdown Export ──────────────────────────────────────────────

function formatToolCall(tc: ConversationEntry["toolCalls"] extends (infer T)[] | undefined ? T : never): string[] {
  const lines: string[] = []
  const status = tc.status === "completed" ? "✅" : tc.status === "error" ? "❌" : "⏳"
  lines.push(`### ${status} 工具: \`${tc.name}\``, "")
  if (tc.input) {
    lines.push("**输入:**", "```json", JSON.stringify(tc.input, null, 2), "```", "")
  }
  if (tc.output !== undefined) {
    lines.push("**输出:**", "```json", typeof tc.output === "string" ? tc.output : JSON.stringify(tc.output, null, 2), "```", "")
  }
  return lines
}

function formatEntry(entry: ConversationEntry): string[] {
  if (entry.compactionSummary) return ["---", `> ⚡ 上下文已压缩: ${entry.compactionSummary}`, ""]

  const time = new Date(entry.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const lines: string[] = []

  if (entry.role === "user") {
    lines.push(`## 👤 你 _(${time})_`, "", entry.content, "")
  }

  if (entry.role === "assistant") {
    lines.push(`## 🤖 Agent _(${time})_`, "")
    if (entry.reasoningContent) {
      lines.push("<details>", "<summary>💭 推理过程</summary>", "", entry.reasoningContent, "", "</details>", "")
    }
    if (entry.toolCalls?.length) {
      for (const tc of entry.toolCalls) lines.push(...formatToolCall(tc))
    }
    if (entry.content) lines.push(entry.content, "")
    if (entry.usage) {
      lines.push(`_Token 用量: ${entry.usage.inputTokens.toLocaleString()} 输入 / ${entry.usage.outputTokens.toLocaleString()} 输出_`, "")
    }
  }

  return lines
}

export function exportToMarkdown(entries: ConversationEntry[], agentName: string): string {
  const lines: string[] = [
    `# 会话记录 — ${agentName}`, "", `> 导出时间: ${new Date().toLocaleString("zh-CN")}`, "",
  ]
  for (const entry of entries) lines.push(...formatEntry(entry))
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
