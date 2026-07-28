import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle, ChevronDown, ChevronRight, Clock, Loader2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toolDisplayName } from "@/lib/tool-i18n"
import type { ToolCallNode } from "@/types/replay"

interface ToolCallCardProps {
  node: ToolCallNode
  compact?: boolean
  highlight?: boolean
  eventIndex?: number
  onJump?: (index: number) => void
}

export function ToolCallCard({ node, compact, highlight, eventIndex, onJump }: ToolCallCardProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const statusIcon = {
    running: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    completed: <CheckCircle className="h-3 w-3 text-success" />,
    error: <XCircle className="h-3 w-3 text-destructive" />,
  }[node.status]

  const handleClick = () => {
    if (onJump && eventIndex !== undefined) onJump(eventIndex)
    else setExpanded(!expanded)
  }

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card",
        compact ? "text-xs" : "text-sm",
      )}
      data-event-index={eventIndex}
    >
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
      >
        {expanded
          ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
        {statusIcon}
        <span className="flex-1 truncate text-xs" title={node.name}>{toolDisplayName(node.name, t)}</span>
        {node.durationMs != null && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {formatDuration(node.durationMs)}
          </span>
        )}
        <Badge variant="outline" className={cn("rounded-md px-1 py-0 text-[9px]", statusColor(node.status))}>
          {node.status}
        </Badge>
      </button>
      {expanded && (
        <div className="border-t border-border px-2.5 py-2 space-y-2">
          {node.input != null && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("common.input")}</span>
              <pre className="mt-0.5 max-h-28 overflow-auto rounded bg-muted/50 p-1.5 font-mono text-[10px] text-muted-foreground">
                {JSON.stringify(node.input, null, 2)}
              </pre>
            </div>
          )}
          {node.output != null && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("common.output")}</span>
              <pre className="mt-0.5 max-h-28 overflow-auto rounded bg-muted/50 p-1.5 font-mono text-[10px] text-muted-foreground">
                {JSON.stringify(node.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function statusColor(status: string): string {
  switch (status) {
    case "running": return "text-blue-500"
    case "completed": return "text-success"
    case "error": return "text-destructive"
    default: return ""
  }
}
