import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, Check, ChevronDown, ChevronRight, Clock, GitBranch, Loader2, ShieldCheck, ShieldQuestion, Wrench, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { truncate } from "@/lib/format"
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

function getStatusConfig(t: TFunction): Record<string, { icon: typeof Clock; color: string; bg: string; label: string }> {
  return {
    pending: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", label: t("status.pending") },
    running: { icon: Loader2, color: "text-primary", bg: "bg-primary/10", label: t("conversation.groupRunning") },
    completed: { icon: Check, color: "text-success", bg: "bg-success/10", label: t("status.completed") },
    error: { icon: X, color: "text-destructive", bg: "bg-destructive/10", label: t("status.error") },
    denied: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", label: t("status.denied") },
    pending_approval: { icon: ShieldQuestion, color: "text-warning", bg: "bg-warning/10", label: t("status.pendingApproval") },
    sub_agent_running: { icon: GitBranch, color: "text-blue-500", bg: "bg-blue-500/10", label: t("status.delegating") },
  }
}

function formatDuration(start?: number, end?: number): string | null {
  if (!start) return null
  const ms = (end ?? Date.now()) - start
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function extractInputSummary(toolName: string, input: unknown): string | null {
  if (!input || typeof input !== "object") return null
  const obj = input as Record<string, unknown>

  switch (toolName) {
    case "read_file":
    case "write_file":
    case "edit_file":
    case "create_directory":
    case "list_directory":
      return typeof obj.path === "string" ? obj.path : null
    case "run_command":
      return typeof obj.command === "string" ? obj.command : null
    case "search_files":
      if (typeof obj.pattern === "string") {
        return typeof obj.path === "string" ? `${obj.pattern} in ${obj.path}` : obj.pattern
      }
      return null
    case "delegate_task":
      return typeof obj.task === "string" ? truncate(obj.task, 60) : null
    case "web_fetch":
      return typeof obj.url === "string" ? obj.url : null
    case "echo":
      return typeof obj.message === "string" ? truncate(obj.message, 40) : null
    default:
      return null
  }
}

function ApprovalButtons({ approvalId, onApprove, onDeny }: { approvalId?: string; onApprove?: (id: string) => void; onDeny?: (id: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className="border-t border-warning/20 bg-warning/5 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-warning">{t("conversation.needConfirm")}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="default" className="h-7 gap-1.5 rounded-lg bg-success text-xs text-white hover:bg-success/90" onClick={(e) => { e.stopPropagation(); approvalId && onApprove?.(approvalId) }} disabled={!approvalId}>
            <ShieldCheck className="h-3.5 w-3.5" /> {t("common.approve")}
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 rounded-lg border-destructive/30 text-xs text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); approvalId && onDeny?.(approvalId) }} disabled={!approvalId}>
            <X className="h-3.5 w-3.5" /> {t("common.reject")}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ToolDetail({ toolCall }: { toolCall: ToolCallEntry }) {
  const { t } = useTranslation()
  const inputPreview = toolCall.input ? truncate(JSON.stringify(toolCall.input), 80) : null
  const outputPreview = toolCall.output ? truncate(typeof toolCall.output === "string" ? toolCall.output : JSON.stringify(toolCall.output), 100) : null

  return (
    <CollapsibleContent>
      <div className="border-t border-border px-3 py-2">
        <div className="flex flex-col gap-1.5">
          {inputPreview && <div><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("common.input")}</span><p className="mt-0.5 font-mono text-[11px] leading-relaxed text-muted-foreground">{inputPreview}</p></div>}
          {toolCall.status === "completed" && outputPreview && <div><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("common.output")}</span><p className="mt-0.5 font-mono text-[11px] leading-relaxed text-muted-foreground">{outputPreview}</p></div>}
          {toolCall.status === "error" && outputPreview && <div><span className="text-[10px] font-semibold uppercase tracking-wider text-destructive">{t("common.error")}</span><p className="mt-0.5 font-mono text-[11px] leading-relaxed text-destructive">{outputPreview}</p></div>}
        </div>
      </div>
    </CollapsibleContent>
  )
}

function StatusIcon({ status, config }: { status: string; config: { icon: typeof Clock; color: string; bg: string; label: string } }) {
  if (status === "running" || status === "sub_agent_running") return <Loader2 className={cn("h-3.5 w-3.5 animate-spin", config.color)} />
  if (status === "denied" || status === "pending_approval") return <config.icon className={cn("h-3.5 w-3.5", config.color)} />
  return <Wrench className={cn("h-3.5 w-3.5", config.color)} />
}

export function ToolOperationCard({ toolCall, isSelected, onSelect, onApprove, onDeny }: ToolOperationCardProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(toolCall.status === "pending_approval" || toolCall.status === "denied")
  const config = getStatusConfig(t)[toolCall.status]
  const duration = formatDuration(toolCall.startTime, toolCall.endTime)
  const needsApproval = toolCall.status === "pending_approval"
  const inputSummary = extractInputSummary(toolCall.name, toolCall.input)

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className={cn("rounded-xl border transition-all", needsApproval ? "border-warning/50 bg-warning/5" : isSelected ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-primary/15")}>
        <div className="flex items-center gap-2 px-3 py-2">
          <CollapsibleTrigger className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={(e) => e.stopPropagation()}>
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </CollapsibleTrigger>
          <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", config.bg)}>
            <StatusIcon status={toolCall.status} config={config} />
          </div>
          <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary hover:underline" onClick={onSelect} title={toolCall.name}>{toolDisplayName(toolCall.name, t)}</span>
          {inputSummary && <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{inputSummary}</span>}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {duration && <span className="font-mono text-[10px] text-muted-foreground">{duration}</span>}
            <Badge variant="secondary" className={cn("rounded-full px-1.5 py-0 text-[10px]", toolCall.status === "completed" && "bg-success/10 text-success", toolCall.status === "error" && "bg-destructive/10 text-destructive", toolCall.status === "running" && "bg-primary/10 text-primary", toolCall.status === "sub_agent_running" && "bg-blue-500/10 text-blue-500", (toolCall.status === "denied" || toolCall.status === "pending_approval") && "bg-warning/10 text-warning")}>{config.label}</Badge>
          </div>
        </div>
        {needsApproval && <ApprovalButtons approvalId={toolCall.approvalId} onApprove={onApprove} onDeny={onDeny} />}
        {toolCall.status === "denied" && <div className="border-t border-warning/20 bg-warning/5 px-3 py-2"><span className="text-xs text-warning">{t("conversation.toolDenied")}</span></div>}
        <ToolDetail toolCall={toolCall} />
      </div>
    </Collapsible>
  )
}
