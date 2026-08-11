export type Rec = Record<string, unknown>

/** asRecord normalizes tool input/output (object or JSON string) to a record. */
export function asRecord(v: unknown): Rec | null {
  if (v == null) return null
  if (typeof v === "string") {
    try {
      const parsed: unknown = JSON.parse(v)
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Rec)
        : null
    } catch {
      return null
    }
  }
  return typeof v === "object" ? (v as Rec) : null
}

export function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}

export function num(v: unknown): number | null {
  return typeof v === "number" ? v : null
}

/** langFromPath guesses a language label from a file extension. */
export function langFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    go: "go",
    py: "python",
    rs: "rust",
    java: "java",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sh: "bash",
    css: "css",
    html: "html",
  }
  return map[ext] ?? ext ?? "text"
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
