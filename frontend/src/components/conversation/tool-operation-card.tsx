import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  GitBranch,
  Loader2,
  ShieldQuestion,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { InlineToolDetail } from "./inline-tool-detail"
import { businessFailed, extractInputSummary } from "./tool-summary"
import { cn } from "@/lib/utils"
import { toolDisplayName } from "@/lib/tool-i18n"
import type { ToolCallEntry } from "@/types/agent"
import type { TFunction } from "i18next"

interface ToolOperationCardProps {
  toolCall: ToolCallEntry
  isSelected: boolean
  onSelect: () => void
  onApprove?: (approvalId: string) => void
  onDeny?: (approvalId: string) => void
}

type StatusCfg = { icon: typeof Clock; color: string; label: string }

function runningStatus(t: TFunction, sub: boolean): StatusCfg {
  return sub
    ? { icon: GitBranch, color: "text-chart-2", label: t("status.delegating") }
    : {
        icon: Loader2,
        color: "text-primary",
        label: t("conversation.groupRunning"),
      }
}

function resolveStatus(toolCall: ToolCallEntry, t: TFunction): StatusCfg {
  switch (toolCall.status) {
    case "running":
      return runningStatus(t, false)
    case "sub_agent_running":
      return runningStatus(t, true)
    case "pending_approval":
      return {
        icon: ShieldQuestion,
        color: "text-warning",
        label: t("status.pendingApproval"),
      }
    case "denied":
      return {
        icon: AlertTriangle,
        color: "text-warning",
        label: t("status.denied"),
      }
    case "error":
      return { icon: X, color: "text-destructive", label: t("status.failed") }
    case "completed":
      return businessFailed(toolCall)
        ? { icon: X, color: "text-destructive", label: t("status.failed") }
        : { icon: Check, color: "text-success", label: t("status.success") }
    default:
      return {
        icon: Clock,
        color: "text-muted-foreground",
        label: t("status.pending"),
      }
  }
}

function formatDuration(start?: number, end?: number): string | null {
  if (!start) return null
  const ms = (end ?? Date.now()) - start
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function StatusIcon({ status, config }: { status: string; config: StatusCfg }) {
  if (status === "running" || status === "sub_agent_running")
    return (
      <Loader2 className={cn("h-3 w-3 shrink-0 animate-spin", config.color)} />
    )
  return <config.icon className={cn("h-3 w-3 shrink-0", config.color)} />
}

export function ToolOperationCard({
  toolCall,
  isSelected,
}: ToolOperationCardProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(
    toolCall.status === "pending_approval" || toolCall.status === "denied"
  )
  const config = resolveStatus(toolCall, t)
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <ToolCardTrigger
        toolCall={toolCall}
        isSelected={isSelected}
        expanded={expanded}
        config={config}
        duration={formatDuration(toolCall.startTime, toolCall.endTime)}
        inputSummary={extractInputSummary(toolCall.name, toolCall.input)}
      />
      <CollapsibleContent>
        <div className="ml-5 border-l-2 border-primary/15 py-1.5 pl-3">
          <InlineToolDetail toolCall={toolCall} />
          {toolCall.status === "denied" && (
            <p className="mt-1.5 text-xs text-warning">
              {t("conversation.toolDenied")}
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ToolCardTrigger({
  toolCall,
  isSelected,
  expanded,
  config,
  duration,
  inputSummary,
}: {
  toolCall: ToolCallEntry
  isSelected: boolean
  expanded: boolean
  config: StatusCfg
  duration: string | null
  inputSummary: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <CollapsibleTrigger
      render={
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto w-full justify-start gap-1.5 rounded-lg px-2 py-1 text-left font-mono text-[10px]",
            isSelected
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        />
      }
    >
      <StatusIcon status={toolCall.status} config={config} />
      {expanded ? (
        <ChevronDown className="h-3 w-3 shrink-0" />
      ) : (
        <ChevronRight className="h-3 w-3 shrink-0" />
      )}
      <span
        className="shrink-0 truncate text-muted-foreground"
        title={toolCall.name}
      >
        {toolDisplayName(toolCall.name, t)}
      </span>
      {inputSummary && (
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {inputSummary}
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {duration && (
          <span className="text-muted-foreground/70">{duration}</span>
        )}
        <span className={cn("text-[10px]", config.color)}>{config.label}</span>
      </span>
    </CollapsibleTrigger>
  )
}
