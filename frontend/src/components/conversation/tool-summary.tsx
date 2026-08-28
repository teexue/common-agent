import type { ReactNode } from "react"
import type { TFunction } from "i18next"
import { asRecord } from "@/components/inspector/tool-detail-utils"
import { diffLines } from "@/components/inspector/diff-utils"
import { truncate } from "@/lib/format"
import { toolDisplayName } from "@/lib/tool-i18n"
import type { ToolCallEntry } from "@/types/agent"

/** businessFailed reports whether a completed tool call failed at the
 * business level — e.g. run_command exited non-zero, or the output carries
 * an `error` field. The raw `completed` status only means execution finished. */
export function businessFailed(toolCall: ToolCallEntry): boolean {
  if (toolCall.status !== "completed") return false
  const rec = asRecord(toolCall.output)
  if (rec && rec.error != null && rec.error !== "") return true
  if (toolCall.name === "run_command") {
    const code = rec && typeof rec.exit_code === "number" ? rec.exit_code : null
    if (code !== null && code !== 0) return true
  }
  return false
}

function lineCount(s: string): number {
  return s === "" ? 0 : s.split("\n").length
}

function editCounts(
  oldStr: string,
  newStr: string
): { add: number; del: number } {
  const lines = diffLines(oldStr, newStr)
  return {
    add: lines.filter((l) => l.type === "add").length,
    del: lines.filter((l) => l.type === "del").length,
  }
}

function statSpans(add: number, del: number): ReactNode {
  return (
    <>
      {add > 0 && <span className="text-success"> +{add}</span>}
      {del > 0 && <span className="text-destructive"> -{del}</span>}
    </>
  )
}

function asInputRecord(input: unknown): Record<string, unknown> | null {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>
  }
  if (typeof input === "string" && input.trim().startsWith("{")) {
    try {
      const v = JSON.parse(input) as unknown
      if (v && typeof v === "object" && !Array.isArray(v)) {
        return v as Record<string, unknown>
      }
    } catch {
      return null
    }
  }
  return null
}

function shortPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean)
  if (parts.length <= 2) return path
  return parts.slice(-2).join("/")
}

function firstStringParam(obj: Record<string, unknown>): string | null {
  const keys = [
    "path",
    "query",
    "url",
    "command",
    "pattern",
    "task",
    "message",
    "name",
  ]
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === "string" && v.trim()) return v
  }
  return null
}

function statText(add: number, del: number): string {
  const bits: string[] = []
  if (add > 0) bits.push(`+${add}`)
  if (del > 0) bits.push(`-${del}`)
  return bits.join(" ")
}

/** extractInputSummaryText is a compact, tool-specific one-line preview of
 * a tool call's input (plain text, for aggregated group headers). */
export function extractInputSummaryText(
  toolName: string,
  input: unknown
): string | null {
  const obj = asInputRecord(input)
  if (!obj) return null
  const path = typeof obj.path === "string" ? shortPath(obj.path) : null
  switch (toolName) {
    case "read_file":
    case "create_directory":
    case "list_directory":
      return path
    case "write_file": {
      const add = lineCount(typeof obj.content === "string" ? obj.content : "")
      const stat = statText(add, 0)
      if (!path) return stat || null
      return stat ? `${path} ${stat}` : path
    }
    case "edit_file": {
      const { add, del } = editCounts(
        typeof obj.old_string === "string" ? obj.old_string : "",
        typeof obj.new_string === "string" ? obj.new_string : ""
      )
      const stat = statText(add, del)
      if (!path) return stat || null
      return stat ? `${path} ${stat}` : path
    }
    case "run_command":
      return typeof obj.command === "string"
        ? `$ ${truncate(obj.command, 48)}`
        : null
    case "search_files":
      if (typeof obj.pattern !== "string") return null
      return path ? `${obj.pattern} · ${path}` : obj.pattern
    case "delegate_task":
      return typeof obj.task === "string" ? truncate(obj.task, 48) : null
    case "web_fetch":
      return typeof obj.url === "string" ? truncate(obj.url, 48) : null
    case "echo":
      return typeof obj.message === "string" ? truncate(obj.message, 40) : null
    case "knowledge_search":
      return typeof obj.query === "string" ? truncate(obj.query, 40) : null
    default: {
      const v = firstStringParam(obj)
      return v ? truncate(v.includes("/") ? shortPath(v) : v, 40) : null
    }
  }
}

/** extractInputSummary produces a compact, tool-specific one-line preview of a
 * tool call's input for use in collapsed trigger rows and approval bars. */
export function extractInputSummary(
  toolName: string,
  input: unknown
): ReactNode {
  const obj = asInputRecord(input)
  if (!obj) return null
  const path = typeof obj.path === "string" ? obj.path : null
  if (
    toolName === "read_file" ||
    toolName === "create_directory" ||
    toolName === "list_directory"
  ) {
    return path
  }
  if (toolName === "write_file") {
    const add = lineCount(typeof obj.content === "string" ? obj.content : "")
    if (add === 0) return path
    const stat = statSpans(add, 0)
    return path ? (
      <>
        {path} {stat}
      </>
    ) : (
      stat
    )
  }
  if (toolName === "edit_file") {
    const { add, del } = editCounts(
      typeof obj.old_string === "string" ? obj.old_string : "",
      typeof obj.new_string === "string" ? obj.new_string : ""
    )
    if (add === 0 && del === 0) return path
    const stat = statSpans(add, del)
    return path ? (
      <>
        {path} {stat}
      </>
    ) : (
      stat
    )
  }
  if (toolName === "run_command" && typeof obj.command === "string") {
    return (
      <>
        <span className="text-muted-foreground/60">$</span> {obj.command}
      </>
    )
  }
  return extractInputSummaryText(toolName, input)
}

const MAX_SUMMARY_GROUPS = 4

/** formatToolGroupSummary lists which tools ran and what they operated on,
 * grouping consecutive calls of the same tool. */
export function formatToolGroupSummary(
  toolCalls: ToolCallEntry[],
  t: TFunction
): string {
  const groups: { name: string; details: string[] }[] = []
  for (const tc of toolCalls) {
    const name = toolDisplayName(tc.name, t)
    const detail = extractInputSummaryText(tc.name, tc.input) ?? ""
    const last = groups[groups.length - 1]
    if (last && last.name === name) last.details.push(detail)
    else groups.push({ name, details: [detail] })
  }
  const parts = groups.map(formatGroup)
  if (parts.length <= MAX_SUMMARY_GROUPS) return parts.join(" · ")
  const kept = parts.slice(0, MAX_SUMMARY_GROUPS - 1)
  const rest = groups
    .slice(MAX_SUMMARY_GROUPS - 1)
    .reduce((n, g) => n + g.details.length, 0)
  return `${kept.join(" · ")} · +${rest}`
}

function formatGroup(g: { name: string; details: string[] }): string {
  const ds = g.details.map((d) => d.trim()).filter(Boolean)
  if (ds.length === 0) return g.name
  if (ds.length === 1) return `${g.name} ${ds[0]}`
  return `${g.name} ${ds.join(", ")}`
}
