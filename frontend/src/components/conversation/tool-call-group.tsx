import { useState } from "react"
import { ChevronDown, ChevronRight, Check, X, Loader2, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { truncate } from "@/lib/format"
import { ToolOperationCard } from "./tool-operation-card"
import type { ToolCallEntry } from "@/types/agent"

interface ToolCallGroupProps {
  toolCalls: ToolCallEntry[]
  selectedToolCallId: string | null
  onSelectToolCall: (id: string) => void
  onApproveTool?: (approvalId: string) => void
  onDenyTool?: (approvalId: string) => void
}

function getGroupStatus(toolCalls: ToolCallEntry[]): { label: string; icon: typeof Check; color: string } {
  const hasRunning = toolCalls.some((tc) => tc.status === "running" || tc.status === "sub_agent_running")
  const hasPendingApproval = toolCalls.some((tc) => tc.status === "pending_approval")
  const hasError = toolCalls.some((tc) => tc.status === "error")
  const allCompleted = toolCalls.every((tc) => tc.status === "completed")

  if (hasRunning) return { label: "执行中", icon: Loader2, color: "text-primary" }
  if (hasPendingApproval) return { label: "待审批", icon: Wrench, color: "text-warning" }
  if (hasError) return { label: "有错误", icon: X, color: "text-destructive" }
  if (allCompleted) return { label: "全部完成", icon: Check, color: "text-success" }
  return { label: "等待中", icon: Wrench, color: "text-muted-foreground" }
}

function formatToolSummary(toolCalls: ToolCallEntry[]): string {
  const summaries = toolCalls.map((tc) => {
    const input = tc.input as Record<string, unknown> | undefined
    switch (tc.name) {
      case "read_file":
      case "list_directory":
        return input?.path ? String(input.path) : tc.name
      case "run_command":
        return input?.command ? truncate(String(input.command), 30) : tc.name
      default:
        return tc.name
    }
  })
  if (summaries.length <= 3) return summaries.join(", ")
  return `${summaries.slice(0, 3).join(", ")} +${summaries.length - 3}`
}

export function ToolCallGroup({ toolCalls, selectedToolCallId, onSelectToolCall, onApproveTool, onDenyTool }: ToolCallGroupProps) {
  const [expanded, setExpanded] = useState(false)

  // 单个 tool call 时保持原样
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

  const status = getGroupStatus(toolCalls)
  const StatusIcon = status.icon
  const selectedTc = toolCalls.find((tc) => tc.id === selectedToolCallId)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* 聚合头部 */}
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
            {toolCalls.length} 个工具调用
          </span>
          <span className="ml-2 text-xs text-muted-foreground truncate">
            {formatToolSummary(toolCalls)}
          </span>
        </div>
        <span className={cn("text-xs font-medium", status.color)}>{status.label}</span>
      </button>

      {/* 展开的详情 */}
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

      {/* 选中的 tool call 始终显示（即使折叠） */}
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
