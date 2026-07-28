import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronRight, Check, X, Loader2, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { truncate } from "@/lib/format"
import { toolDisplayName } from "@/lib/tool-i18n"
import { ToolOperationCard } from "./tool-operation-card"
import type { ToolCallEntry } from "@/types/agent"
import type { TFunction } from "i18next"

interface ToolCallGroupProps {
  toolCalls: ToolCallEntry[]
  selectedToolCallId: string | null
  onSelectToolCall: (id: string) => void
  onApproveTool?: (approvalId: string) => void
  onDenyTool?: (approvalId: string) => void
}

function getGroupStatus(toolCalls: ToolCallEntry[], t: TFunction): { label: string; icon: typeof Check; color: string } {
  const hasRunning = toolCalls.some((tc) => tc.status === "running" || tc.status === "sub_agent_running")
  const hasPendingApproval = toolCalls.some((tc) => tc.status === "pending_approval")
  const hasError = toolCalls.some((tc) => tc.status === "error")
  const allCompleted = toolCalls.every((tc) => tc.status === "completed")

  if (hasRunning) return { label: t("conversation.groupRunning"), icon: Loader2, color: "text-primary" }
  if (hasPendingApproval) return { label: t("conversation.groupPendingApproval"), icon: Wrench, color: "text-warning" }
  if (hasError) return { label: t("conversation.groupError"), icon: X, color: "text-destructive" }
  if (allCompleted) return { label: t("conversation.groupAllDone"), icon: Check, color: "text-success" }
  return { label: t("conversation.groupWaiting"), icon: Wrench, color: "text-muted-foreground" }
}

function formatToolSummary(toolCalls: ToolCallEntry[], t: TFunction): string {
  const summaries = toolCalls.map((tc) => {
    const input = tc.input as Record<string, unknown> | undefined
    switch (tc.name) {
      case "read_file":
      case "list_directory":
        return input?.path ? String(input.path) : toolDisplayName(tc.name, t)
      case "run_command":
        return input?.command ? truncate(String(input.command), 30) : toolDisplayName(tc.name, t)
      default:
        return toolDisplayName(tc.name, t)
    }
  })
  if (summaries.length <= 3) return summaries.join(", ")
  return `${summaries.slice(0, 3).join(", ")} +${summaries.length - 3}`
}

export function ToolCallGroup({ toolCalls, selectedToolCallId, onSelectToolCall, onApproveTool, onDenyTool }: ToolCallGroupProps) {
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
  const selectedTc = toolCalls.find((tc) => tc.id === selectedToolCallId)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <StatusIcon className={cn("h-3.5 w-3.5", status.color, (status.icon === Loader2) && "animate-spin")} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">
            {t("conversation.toolCallsCount", { count: toolCalls.length })}
          </span>
          <span className="ml-2 text-xs text-muted-foreground truncate">
            {formatToolSummary(toolCalls, t)}
          </span>
        </div>
        <span className={cn("text-xs font-medium", status.color)}>{status.label}</span>
      </button>

      {expanded && (
        <div className="border-t border-border px-2 py-1.5 flex flex-col gap-1.5">
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
      )}

      {!expanded && selectedTc && (
        <div className="border-t border-primary/20 px-2 py-1.5">
          <ToolOperationCard
            toolCall={selectedTc}
            isSelected={true}
            onSelect={() => onSelectToolCall(selectedTc.id)}
            onApprove={onApproveTool}
            onDeny={onDenyTool}
          />
        </div>
      )}
    </div>
  )
}
