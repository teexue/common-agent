import { cn } from "@/lib/utils"

import type { DiffLine } from "./diff-utils"

/** DiffView renders diff rows with dual line numbers and +/- gutter markers. */
export function DiffView({ lines }: { lines: DiffLine[] }) {
  if (lines.length === 0) return null
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="max-h-[32rem] overflow-auto py-1">
        {lines.map((l, i) => (
          <div
            key={i}
            className={cn(
              "flex font-mono text-xs leading-5",
              l.type === "add" && "bg-success/10",
              l.type === "del" && "bg-destructive/10"
            )}
          >
            <span className="w-9 shrink-0 px-1 text-right text-[10px] leading-5 text-muted-foreground/60 select-none">
              {l.oldNo ?? l.newNo ?? ""}
            </span>
            <span
              className={cn(
                "w-4 shrink-0 text-center select-none",
                l.type === "add" && "text-success",
                l.type === "del" && "text-destructive"
              )}
            >
              {l.type === "add" ? "+" : l.type === "del" ? "-" : ""}
            </span>
            <span className="min-w-0 pr-3 break-all whitespace-pre-wrap">{l.text || " "}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
