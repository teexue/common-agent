import type { ReactNode } from "react"
import { File } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Rec } from "@/components/inspector/tool-detail-utils"
import type { DiffLine } from "@/components/inspector/diff-utils"

export interface ToolRenderProps {
  input: Rec | null
  output: Rec | null
}

export function Label({ children }: { children: string }) {
  return (
    <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </span>
  )
}

export function Note({
  children,
  tone = "muted",
}: {
  children: string
  tone?: "muted" | "warning"
}) {
  return (
    <p
      className={cn(
        "text-[11px]",
        tone === "warning" ? "text-warning" : "text-muted-foreground"
      )}
    >
      {children}
    </p>
  )
}

export function CodeBlock({
  text,
  tone = "default",
}: {
  text: string
  tone?: "default" | "destructive"
}) {
  return (
    <pre
      className={cn(
        "max-h-80 overflow-auto rounded-md bg-muted/40 px-2.5 py-2 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap",
        tone === "destructive" ? "text-destructive" : "text-foreground"
      )}
    >
      {text}
    </pre>
  )
}

export function DiffBlock({ lines }: { lines: DiffLine[] }) {
  if (lines.length === 0) return null
  return (
    <div className="max-h-56 overflow-auto">
      {lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            "px-2.5 font-mono text-[11px] leading-relaxed whitespace-pre",
            l.type === "add" && "bg-success/10 text-success",
            l.type === "del" && "bg-destructive/10 text-destructive",
            l.type === "ctx" && "text-muted-foreground"
          )}
        >
          <span className="mr-1 opacity-50 select-none">
            {l.type === "add" ? "+" : l.type === "del" ? "-" : " "}
          </span>
          {l.text}
        </div>
      ))}
    </div>
  )
}

export function FileContentBlock({ text }: { text: string }) {
  const lines = text === "" ? [] : text.split("\n")
  if (lines.length === 0) return null
  return (
    <div className="max-h-56 overflow-auto">
      {lines.map((l, i) => (
        <div
          key={i}
          className="flex gap-2 px-2.5 font-mono text-[11px] leading-relaxed whitespace-pre"
        >
          <span className="w-6 shrink-0 text-right text-muted-foreground/50 select-none">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 break-all text-foreground">{l}</span>
        </div>
      ))}
    </div>
  )
}

export function PathLine({ path }: { path: string }) {
  if (!path) return null
  return (
    <p className="font-mono text-[11px] break-all text-foreground">{path}</p>
  )
}

export function Meta({
  children,
  tone = "muted",
}: {
  children: ReactNode
  tone?: "muted" | "success" | "destructive"
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
        tone === "success" && "bg-success/15 text-success",
        tone === "destructive" && "bg-destructive/15 text-destructive",
        tone === "muted" && "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

export function FilePanel({
  path,
  meta,
  children,
}: {
  path: string
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border/70 bg-muted/20">
      <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-2.5 py-1.5">
        <File className="h-3 w-3 shrink-0 text-primary" />
        <span
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground"
          title={path}
        >
          {path}
        </span>
        {meta && (
          <span className="flex shrink-0 items-center gap-1">{meta}</span>
        )}
      </div>
      {children}
    </div>
  )
}

export function Terminal({
  label = "bash",
  children,
}: {
  label?: string
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-md border border-terminal-border bg-terminal">
      <div className="flex items-center gap-1.5 border-b border-terminal-border/60 px-2.5 py-1">
        <span className="h-2 w-2 rounded-full bg-terminal-error/70" />
        <span className="h-2 w-2 rounded-full bg-warning/70" />
        <span className="h-2 w-2 rounded-full bg-terminal-success/70" />
        <span className="ml-1.5 font-mono text-[10px] text-terminal-muted">
          {label}
        </span>
      </div>
      <div className="max-h-56 overflow-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed">
        {children}
      </div>
    </div>
  )
}
