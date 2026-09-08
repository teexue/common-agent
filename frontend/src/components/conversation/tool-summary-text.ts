import { truncate } from "@/lib/format"
import { diffLines } from "@/components/inspector/diff-utils"

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

function pathOf(obj: Record<string, unknown>): string | null {
  return typeof obj.path === "string" ? shortPath(obj.path) : null
}

function writeFileText(obj: Record<string, unknown>): string | null {
  const path = pathOf(obj)
  const add = lineCount(typeof obj.content === "string" ? obj.content : "")
  const stat = statText(add, 0)
  if (!path) return stat || null
  return stat ? `${path} ${stat}` : path
}

function editFileText(obj: Record<string, unknown>): string | null {
  const path = pathOf(obj)
  const { add, del } = editCounts(
    typeof obj.old_string === "string" ? obj.old_string : "",
    typeof obj.new_string === "string" ? obj.new_string : ""
  )
  const stat = statText(add, del)
  if (!path) return stat || null
  return stat ? `${path} ${stat}` : path
}

function searchFilesText(obj: Record<string, unknown>): string | null {
  if (typeof obj.pattern !== "string") return null
  const path = pathOf(obj)
  return path ? `${obj.pattern} · ${path}` : obj.pattern
}

const EXTRACT: Record<string, (obj: Record<string, unknown>) => string | null> =
  {
    read_file: pathOf,
    read_image: pathOf,
    create_directory: pathOf,
    list_directory: pathOf,
    delete_file: pathOf,
    write_file: writeFileText,
    edit_file: editFileText,
    run_command: (obj) =>
      typeof obj.command === "string" ? `$ ${truncate(obj.command, 48)}` : null,
    search_files: searchFilesText,
    delegate_task: (obj) =>
      typeof obj.task === "string" ? truncate(obj.task, 48) : null,
    web_fetch: (obj) =>
      typeof obj.url === "string" ? truncate(obj.url, 48) : null,
    echo: (obj) =>
      typeof obj.message === "string" ? truncate(obj.message, 40) : null,
    knowledge_search: (obj) =>
      typeof obj.query === "string" ? truncate(obj.query, 40) : null,
  }

/** extractInputSummaryText is a compact, tool-specific one-line preview. */
export function extractInputSummaryText(
  toolName: string,
  input: unknown
): string | null {
  const obj = asInputRecord(input)
  if (!obj) return null
  const fn = EXTRACT[toolName]
  if (fn) return fn(obj)
  const v = firstStringParam(obj)
  return v ? truncate(v.includes("/") ? shortPath(v) : v, 40) : null
}

export function inputRecord(input: unknown): Record<string, unknown> | null {
  return asInputRecord(input)
}

export { lineCount, editCounts, pathOf }
