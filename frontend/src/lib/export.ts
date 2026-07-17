import i18n from "@/i18n"
import type { ConversationEntry } from "@/types/agent"

function dateLocale(): string {
  return i18n.language?.startsWith("zh") ? "zh-CN" : "en"
}

// ─── Markdown Export ──────────────────────────────────────────────

function formatToolCall(tc: ConversationEntry["toolCalls"] extends (infer T)[] | undefined ? T : never): string[] {
  const lines: string[] = []
  const status = tc.status === "completed" ? "✅" : tc.status === "error" ? "❌" : "⏳"
  lines.push(`### ${status} ${i18n.t("export.tool")}: \`${tc.name}\``, "")
  if (tc.input) {
    lines.push(`**${i18n.t("export.input")}:**`, "```json", JSON.stringify(tc.input, null, 2), "```", "")
  }
  if (tc.output !== undefined) {
    lines.push(`**${i18n.t("export.output")}:**`, "```json", typeof tc.output === "string" ? tc.output : JSON.stringify(tc.output, null, 2), "```", "")
  }
  return lines
}

function formatEntry(entry: ConversationEntry): string[] {
  if (entry.compactionSummary) {
    return ["---", `> ⚡ ${i18n.t("export.compaction")}: ${entry.compactionSummary}`, ""]
  }

  const time = new Date(entry.timestamp).toLocaleTimeString(dateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const lines: string[] = []

  if (entry.role === "user") {
    lines.push(`## 👤 ${i18n.t("export.you")} _(${time})_`, "", entry.content, "")
  }

  if (entry.role === "assistant") {
    lines.push(`## 🤖 Agent _(${time})_`, "")
    if (entry.reasoningContent) {
      lines.push("<details>", `<summary>💭 ${i18n.t("export.reasoning")}</summary>`, "", entry.reasoningContent, "", "</details>", "")
    }
    if (entry.toolCalls?.length) {
      for (const tc of entry.toolCalls) lines.push(...formatToolCall(tc))
    }
    if (entry.content) lines.push(entry.content, "")
    if (entry.usage) {
      lines.push(
        `_${i18n.t("export.tokenUsage", {
          input: entry.usage.inputTokens.toLocaleString(dateLocale()),
          output: entry.usage.outputTokens.toLocaleString(dateLocale()),
        })}_`,
        "",
      )
    }
  }

  return lines
}

export function exportToMarkdown(entries: ConversationEntry[], agentName: string): string {
  const lines: string[] = [
    `# ${i18n.t("export.title", { agent: agentName })}`,
    "",
    `> ${i18n.t("export.exportedAt", { time: new Date().toLocaleString(dateLocale()) })}`,
    "",
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
