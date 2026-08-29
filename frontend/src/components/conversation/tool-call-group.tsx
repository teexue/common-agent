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
  const running = toolCalls.some(
    (tc) => tc.status === "running" || tc.status === "sub_agent_running"
  )
  if (running)
    return {
      label: t("conversation.groupRunning"),
      icon: Loader2,
      color: "text-primary",
    }
  if (toolCalls.some((tc) => tc.status === "pending_approval"))
    return {
      label: t("conversation.groupPendingApproval"),
      icon: Wrench,
      color: "text-warning",
    }
  return terminalGroupStatus(toolCalls, t)
}

function terminalGroupStatus(
  toolCalls: ToolCallEntry[],
  t: TFunction
): { label: string; icon: typeof Check; color: string } {
  const hasFailure = toolCalls.some(isFailure)
  const hasSuccess = toolCalls.some(isSuccess)
  if (!toolCalls.every(isTerminal))
    return {
      label: t("conversation.groupWaiting"),
      icon: Wrench,
      color: "text-muted-foreground",
    }
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

export function ToolCallGroup(props: ToolCallGroupProps) {
  const [expanded, setExpanded] = useState(false)
  if (props.toolCalls.length === 1) {
    const tc = props.toolCalls[0]
    return (
      <ToolOperationCard
        toolCall={tc}
        isSelected={props.selectedToolCallId === tc.id}
        onSelect={() => props.onSelectToolCall(tc.id)}
        onApprove={props.onApproveTool}
        onDeny={props.onDenyTool}
      />
    )
  }
  return (
    <MultiToolGroup
      props={props}
      expanded={expanded}
      onOpenChange={setExpanded}
    />
  )
}

function MultiToolGroup({
  props,
  expanded,
  onOpenChange,
}: {
  props: ToolCallGroupProps
  expanded: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const status = getGroupStatus(props.toolCalls, t)
  return (
    <Collapsible open={expanded} onOpenChange={onOpenChange}>
      <GroupTrigger
        expanded={expanded}
        status={status}
        summary={formatToolGroupSummary(props.toolCalls, t)}
        countLabel={t("conversation.toolCallsCount", {
          count: props.toolCalls.length,
        })}
      />
      <CollapsibleContent>
        <div className="ml-5 flex flex-col gap-0.5 border-l-2 border-primary/15 pl-3">
          {props.toolCalls.map((tc) => (
            <ToolOperationCard
              key={tc.id}
              toolCall={tc}
              isSelected={props.selectedToolCallId === tc.id}
              onSelect={() => props.onSelectToolCall(tc.id)}
              onApprove={props.onApproveTool}
              onDeny={props.onDenyTool}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function GroupTrigger({
  expanded,
  status,
  summary,
  countLabel,
}: {
  expanded: boolean
  status: ReturnType<typeof getGroupStatus>
  summary: string
  countLabel: string
}) {
  const StatusIcon = status.icon
  return (
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
        {summary}
      </span>
      <span className="shrink-0 text-muted-foreground">{countLabel}</span>
      <span className={cn("shrink-0 text-[10px]", status.color)}>
        {status.label}
      </span>
    </CollapsibleTrigger>
  )
}
