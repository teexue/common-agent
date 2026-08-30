import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRight, FileIcon, FilePen } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { diffLines } from "@/components/inspector/diff-utils"
import { cn } from "@/lib/utils"
import type { ConversationEntry } from "@/types/agent"

interface FileChange {
  path: string
  add: number
  del: number
}

function lineCount(s: string): number {
  return s === "" ? 0 : s.split("\n").length
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/")
  return idx >= 0 ? path.slice(idx + 1) : path
}

function tallyToolCall(
  entry: FileChange,
  name: string,
  obj: Record<string, unknown>
): void {
  if (name === "write_file") {
    entry.add += lineCount(typeof obj.content === "string" ? obj.content : "")
    return
  }
  const oldStr = typeof obj.old_string === "string" ? obj.old_string : ""
  const newStr = typeof obj.new_string === "string" ? obj.new_string : ""
  for (const l of diffLines(oldStr, newStr)) {
    if (l.type === "add") entry.add++
    else if (l.type === "del") entry.del++
  }
}

/** computeFileChanges tallies per-file added/deleted lines across completed
 * write_file / edit_file tool calls, preserving first-seen order. */
function computeFileChanges(messages: ConversationEntry[]): FileChange[] {
  const order: string[] = []
  const map = new Map<string, FileChange>()
  for (const msg of messages) {
    for (const tc of msg.toolCalls ?? []) {
      if (tc.status !== "completed") continue
      if (tc.name !== "write_file" && tc.name !== "edit_file") continue
      const obj = (tc.input ?? null) as Record<string, unknown> | null
      if (!obj || typeof obj.path !== "string") continue
      let entry = map.get(obj.path)
      if (!entry) {
        entry = { path: obj.path, add: 0, del: 0 }
        map.set(obj.path, entry)
        order.push(obj.path)
      }
      tallyToolCall(entry, tc.name, obj)
    }
  }
  return order.map((p) => map.get(p) as FileChange)
}

export function FileChangeSummary({
  messages,
  className,
}: {
  messages: ConversationEntry[]
  className?: string
}) {
  const { t } = useTranslation()
  const changes = useMemo(() => computeFileChanges(messages), [messages])
  const [open, setOpen] = useState(false)
  if (changes.length === 0) return null
  const add = changes.reduce((s, c) => s + c.add, 0)
  const del = changes.reduce((s, c) => s + c.del, 0)
  return (
    <div
      className={cn(
        "mx-5 mb-1.5 rounded-xl border border-border bg-card/80 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <FileChangeHeader
          open={open}
          add={add}
          del={del}
          label={t("conversation.filesChanged", { count: changes.length })}
        />
        <CollapsibleContent>
          <FileChangeList changes={changes} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function FileChangeHeader({
  open,
  add,
  del,
  label,
}: {
  open: boolean
  add: number
  del: number
  label: string
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <CollapsibleTrigger className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform",
            open && "rotate-90"
          )}
        />
        <FilePen className="h-3 w-3 shrink-0" />
        <span className="font-mono">{label}</span>
      </CollapsibleTrigger>
      <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px]">
        {add > 0 && <span className="text-success">+{add}</span>}
        {del > 0 && <span className="text-destructive">-{del}</span>}
      </span>
    </div>
  )
}

function FileChangeList({ changes }: { changes: FileChange[] }) {
  return (
    <div className="max-h-48 overflow-y-auto border-t border-border/50 px-3 py-2">
      <ul className="space-y-px overflow-hidden rounded-md">
        {changes.map((c, idx) => (
          <li
            key={c.path}
            className={cn(
              "flex items-center gap-2 px-2 py-1 font-mono text-[11px]",
              idx % 2 === 1 && "bg-muted/30"
            )}
            title={c.path}
          >
            <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {basename(c.path)}
            </span>
            <span className="flex shrink-0 items-center justify-end gap-2 tabular-nums">
              <span className="w-9 text-right text-success">
                {c.add > 0 ? `+${c.add}` : ""}
              </span>
              <span className="w-9 text-right text-destructive">
                {c.del > 0 ? `-${c.del}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
