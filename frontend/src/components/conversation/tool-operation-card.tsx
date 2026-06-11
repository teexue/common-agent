import { useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Wrench,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { truncate } from "@/lib/format"
import type { ToolCallEntry } from "@/types/agent"

interface ToolOperationCardProps {
  toolCall: ToolCallEntry
  isSelected: boolean
  onSelect: () => void
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: "text-muted-foreground",
    bg: "bg-muted",
    label: "等待",
  },
  running: {
    icon: Loader2,
    color: "text-primary",
    bg: "bg-primary/10",
    label: "执行中",
  },
  completed: {
    icon: Check,
    color: "text-success",
    bg: "bg-success/10",
    label: "完成",
  },
  error: {
    icon: X,
    color: "text-destructive",
    bg: "bg-destructive/10",
    label: "错误",
  },
}

function formatDuration(start?: number, end?: number): string | null {
  if (!start) return null
  const ms = (end ?? Date.now()) - start
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function ToolOperationCard({
  toolCall,
  isSelected,
  onSelect,
}: ToolOperationCardProps) {
  const [expanded, setExpanded] = useState(false)
  const config = statusConfig[toolCall.status]
  const duration = formatDuration(toolCall.startTime, toolCall.endTime)

  const inputPreview = toolCall.input
    ? truncate(JSON.stringify(toolCall.input), 80)
    : null

  const outputPreview = toolCall.output
    ? truncate(
        typeof toolCall.output === "string"
          ? toolCall.output
          : JSON.stringify(toolCall.output),
        100
      )
    : null

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className={cn(
          "rounded-xl border transition-all",
          isSelected
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-card hover:border-primary/15"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2">
          <CollapsibleTrigger
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </CollapsibleTrigger>

          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
              config.bg
            )}
          >
            {toolCall.status === "running" ? (
              <Loader2
                className={cn("h-3.5 w-3.5 animate-spin", config.color)}
              />
            ) : (
              <Wrench className={cn("h-3.5 w-3.5", config.color)} />
            )}
          </div>

          <span
            className="cursor-pointer font-mono text-sm font-medium text-foreground hover:text-primary hover:underline"
            onClick={onSelect}
          >
            {toolCall.name}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            {duration && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {duration}
              </span>
            )}
            <Badge
              variant="secondary"
              className={cn(
                "rounded-full px-1.5 py-0 text-[10px]",
                toolCall.status === "completed" &&
                  "bg-success/10 text-success",
                toolCall.status === "error" &&
                  "bg-destructive/10 text-destructive",
                toolCall.status === "running" &&
                  "bg-primary/10 text-primary"
              )}
            >
              {config.label}
            </Badge>
          </div>
        </div>

        {/* Collapsible detail */}
        <CollapsibleContent>
          <div className="border-t border-border px-3 py-2">
            <div className="flex flex-col gap-1.5">
              {inputPreview && (
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    输入
                  </span>
                  <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {inputPreview}
                  </p>
                </div>
              )}
              {toolCall.status === "completed" && outputPreview && (
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    输出
                  </span>
                  <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {outputPreview}
                  </p>
                </div>
              )}
              {toolCall.status === "error" && outputPreview && (
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive">
                    错误
                  </span>
                  <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-destructive">
                    {outputPreview}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
