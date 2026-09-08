import type { ReactNode } from "react"
import type { TFunction } from "i18next"
import { toolDisplayName } from "@/lib/tool-i18n"
import type { ToolCallEntry } from "@/types/agent"
import {
  extractInputSummaryText,
  inputRecord,
  lineCount,
  editCounts,
} from "./tool-summary-text"

export { extractInputSummaryText }

export function businessFailed(toolCall: ToolCallEntry): boolean {
  if (toolCall.status !== "completed") return false
  const rec =
    toolCall.output &&
    typeof toolCall.output === "object" &&
    !Array.isArray(toolCall.output)
      ? (toolCall.output as Record<string, unknown>)
      : null
  if (rec && rec.error != null && rec.error !== "") return true
  if (toolCall.name === "run_command") {
    const code = rec && typeof rec.exit_code === "number" ? rec.exit_code : null
    if (code !== null && code !== 0) return true
  }
  return false
}

function statSpans(add: number, del: number): ReactNode {
  return (
    <>
      {add > 0 && <span className="text-success"> +{add}</span>}
      {del > 0 && <span className="text-destructive"> -{del}</span>}
    </>
  )
}

function pathWithStat(
  path: string | null,
  add: number,
  del: number
): ReactNode {
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

function writeFileNode(obj: Record<string, unknown>): ReactNode {
  const path = typeof obj.path === "string" ? obj.path : null
  const add = lineCount(typeof obj.content === "string" ? obj.content : "")
  return pathWithStat(path, add, 0)
}

function editFileNode(obj: Record<string, unknown>): ReactNode {
  const path = typeof obj.path === "string" ? obj.path : null
  const { add, del } = editCounts(
    typeof obj.old_string === "string" ? obj.old_string : "",
    typeof obj.new_string === "string" ? obj.new_string : ""
  )
  return pathWithStat(path, add, del)
}

function runCommandNode(obj: Record<string, unknown>): ReactNode {
  if (typeof obj.command !== "string") return null
  return (
    <>
      <span className="text-muted-foreground/60">$</span> {obj.command}
    </>
  )
}

const NODE: Record<string, (obj: Record<string, unknown>) => ReactNode> = {
  read_file: (obj) => (typeof obj.path === "string" ? obj.path : null),
  read_image: (obj) => (typeof obj.path === "string" ? obj.path : null),
  create_directory: (obj) => (typeof obj.path === "string" ? obj.path : null),
  list_directory: (obj) => (typeof obj.path === "string" ? obj.path : null),
  delete_file: (obj) => (typeof obj.path === "string" ? obj.path : null),
  write_file: writeFileNode,
  edit_file: editFileNode,
  run_command: runCommandNode,
}

export function extractInputSummary(
  toolName: string,
  input: unknown
): ReactNode {
  const obj = inputRecord(input)
  if (!obj) return null
  const fn = NODE[toolName]
  if (fn) return fn(obj)
  return extractInputSummaryText(toolName, input)
}

const MAX_SUMMARY_GROUPS = 4

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
