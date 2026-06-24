import { useState } from "react"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  GitBranch,
  Loader2,
  ShieldCheck,
  ShieldQuestion,
  Wrench,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  onApprove?: (approvalId: string) => void
  onDeny?: (approvalId: string) => void
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
  denied: {
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning/10",
    label: "拒绝",
  },
  pending_approval: {
    icon: ShieldQuestion,
    color: "text-warning",
    bg: "bg-warning/10",
    label: "待审批",
  },
  sub_agent_running: {
    icon: GitBranch,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "委派中",
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
  onApprove,
  onDeny,
}: ToolOperationCardProps) {
  // Auto-expand when pending approval or denied
  const [expanded, setExpanded] = useState(
    toolCall.status === "pending_approval" || toolCall.status === "denied"
  )
  const config = statusConfig[toolCall.status]
  const duration = formatDuration(toolCall.startTime, toolCall.endTime)
  const needsApproval = toolCall.status === "pending_approval"

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
          needsApproval
            ? "border-warning/50 bg-warning/5"
            : isSelected
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
            {toolCall.status === "running" || toolCall.status === "sub_agent_running" ? (
              <Loader2
                className={cn("h-3.5 w-3.5 animate-spin", config.color)}
              />
            ) : toolCall.status === "denied" || toolCall.status === "pending_approval" ? (
              <config.icon className={cn("h-3.5 w-3.5", config.color)} />
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
                  "bg-primary/10 text-primary",
                toolCall.status === "sub_agent_running" &&
                  "bg-blue-500/10 text-blue-500",
                (toolCall.status === "denied" || toolCall.status === "pending_approval") &&
                  "bg-warning/10 text-warning"
              )}
            >
              {config.label}
            </Badge>
          </div>
        </div>

        {/* Approval buttons - shown directly when pending approval */}
        {needsApproval && (
          <div className="border-t border-warning/20 bg-warning/5 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-warning">
                此工具需要确认才能执行
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 gap-1.5 rounded-lg bg-success text-xs text-white hover:bg-success/90"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (toolCall.approvalId) {
                      onApprove?.(toolCall.approvalId)
                    }
                  }}
                  disabled={!toolCall.approvalId}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  批准
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 rounded-lg border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (toolCall.approvalId) {
                      onDeny?.(toolCall.approvalId)
                    }
                  }}
                  disabled={!toolCall.approvalId}
                >
                  <X className="h-3.5 w-3.5" />
                  拒绝
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Denied message */}
        {toolCall.status === "denied" && (
          <div className="border-t border-warning/20 bg-warning/5 px-3 py-2">
            <span className="text-xs text-warning">
              工具执行被拒绝
            </span>
          </div>
        )}

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
