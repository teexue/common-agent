import type { ReactNode } from "react"
import { asRecord } from "@/components/inspector/tool-detail-utils"
import { diffLines } from "@/components/inspector/diff-utils"
import { truncate } from "@/lib/format"
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

function editCounts(oldStr: string, newStr: string): { add: number; del: number } {
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

/** extractInputSummary produces a compact, tool-specific one-line preview of a
 * tool call's input for use in collapsed trigger rows and approval bars. */
export function extractInputSummary(toolName: string, input: unknown): ReactNode {
  if (!input || typeof input !== "object") return null
  const obj = input as Record<string, unknown>
  const path = typeof obj.path === "string" ? obj.path : null
  switch (toolName) {
    case "read_file":
    case "create_directory":
    case "list_directory":
      return path
    case "write_file": {
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
    case "edit_file": {
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
    case "run_command":
      return typeof obj.command === "string" ? (
        <>
          <span className="text-muted-foreground/60">$</span> {obj.command}
        </>
      ) : null
    case "search_files":
      if (typeof obj.pattern === "string") {
        return typeof obj.path === "string" ? `${obj.pattern} in ${obj.path}` : obj.pattern
      }
      return null
    case "delegate_task":
      return typeof obj.task === "string" ? truncate(obj.task, 60) : null
    case "web_fetch":
      return typeof obj.url === "string" ? obj.url : null
    case "echo":
      return typeof obj.message === "string" ? truncate(obj.message, 40) : null
    default:
      return null
  }
}
