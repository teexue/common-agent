import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Loader2,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ToolOperationCard } from "./tool-operation-card"
import { businessFailed, formatToolGroupSummary } from "./tool-summary"
import type { ToolCallEntry } from "@/types/agent"
import type { TFunction } from "i18next"

interface ToolCallGroupProps {
  toolCalls: ToolCallEntry[]
  selectedToolCallId: string | null
  onSelectToolCall: (id: string) => void
  onApproveTool?: (approvalId: string) => void
  onDenyTool?: (approvalId: string) => void
}

function isFailure(tc: ToolCallEntry): boolean {
  return (
    tc.status === "error" ||
    tc.status === "denied" ||
    (tc.status === "completed" && businessFailed(tc))
  )
}

function isSuccess(tc: ToolCallEntry): boolean {
  return tc.status === "completed" && !businessFailed(tc)
}

function isTerminal(tc: ToolCallEntry): boolean {
  return (
    tc.status === "completed" || tc.status === "error" || tc.status === "denied"
  )
}

function getGroupStatus(
  toolCalls: ToolCallEntry[],
  t: TFunction
): { label: string; icon: typeof Check; color: string } {
  const hasRunning = toolCalls.some(
    (tc) => tc.status === "running" || tc.status === "sub_agent_running"
  )
  const hasPendingApproval = toolCalls.some(
    (tc) => tc.status === "pending_approval"
  )
  const hasFailure = toolCalls.some(isFailure)
  const hasSuccess = toolCalls.some(isSuccess)
  const allTerminal = toolCalls.every(isTerminal)

  if (hasRunning)
    return {
      label: t("conversation.groupRunning"),
      icon: Loader2,
      color: "text-primary",
    }
  if (hasPendingApproval)
    return {
      label: t("conversation.groupPendingApproval"),
      icon: Wrench,
      color: "text-warning",
    }
  if (allTerminal) {
    if (hasFailure && hasSuccess)
      return {
        label: t("conversation.groupPartialFailure"),
        icon: AlertTriangle,
        color: "text-warning",
      }
    if (hasFailure)
      return { label: t("status.failed"), icon: X, color: "text-destructive" }
    return { label: t("status.success"), icon: Check, color: "text-success" }
  }
  return {
    label: t("conversation.groupWaiting"),
    icon: Wrench,
    color: "text-muted-foreground",
  }
}

export function ToolCallGroup({
  toolCalls,
  selectedToolCallId,
  onSelectToolCall,
  onApproveTool,
  onDenyTool,
}: ToolCallGroupProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  if (toolCalls.length === 1) {
    return (
      <ToolOperationCard
        toolCall={toolCalls[0]}
        isSelected={selectedToolCallId === toolCalls[0].id}
        onSelect={() => onSelectToolCall(toolCalls[0].id)}
        onApprove={onApproveTool}
        onDeny={onDenyTool}
      />
    )
  }

  const status = getGroupStatus(toolCalls, t)
  const StatusIcon = status.icon

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-auto w-full justify-start gap-1.5 rounded-lg px-2 py-1 text-left font-mono text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        }
      >
        <StatusIcon
          className={cn(
            "h-3 w-3",
            status.color,
            status.icon === Loader2 && "animate-spin"
          )}
        />
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="line-clamp-2 min-w-0 flex-1 text-left text-[10px] leading-snug text-foreground">
          {formatToolGroupSummary(toolCalls, t)}
        </span>
        <span className="shrink-0 text-muted-foreground">
          {t("conversation.toolCallsCount", { count: toolCalls.length })}
        </span>
        <span className={cn("shrink-0 text-[10px]", status.color)}>
          {status.label}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 flex flex-col gap-0.5 border-l-2 border-primary/15 pl-3">
          {toolCalls.map((tc) => (
            <ToolOperationCard
              key={tc.id}
              toolCall={tc}
              isSelected={selectedToolCallId === tc.id}
              onSelect={() => onSelectToolCall(tc.id)}
              onApprove={onApproveTool}
              onDeny={onDenyTool}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
