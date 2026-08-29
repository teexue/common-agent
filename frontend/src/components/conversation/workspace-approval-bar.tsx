import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ShieldCheck, ShieldQuestion, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toolDisplayName } from "@/lib/tool-i18n"
import type { ConversationEntry, ToolCallEntry } from "@/types/agent"
import { extractInputSummary } from "./tool-summary"

function collectPendingApprovals(
  messages: ConversationEntry[]
): ToolCallEntry[] {
  const out: ToolCallEntry[] = []
  for (const msg of messages) {
    for (const tc of msg.toolCalls ?? []) {
      if (tc.status === "pending_approval" && tc.approvalId) out.push(tc)
    }
  }
  return out
}

export function ApprovalBar({
  messages,
  onApprove,
  onDeny,
}: {
  messages: ConversationEntry[]
  onApprove?: (id: string) => void
  onDeny?: (id: string) => void
}) {
  const pending = useMemo(() => collectPendingApprovals(messages), [messages])
  if (pending.length === 0) return null
  return (
    <div className="mx-5 mb-1.5 space-y-1.5">
      {pending.map((tc) => (
        <ApprovalRow
          key={tc.approvalId}
          toolCall={tc}
          onApprove={onApprove}
          onDeny={onDeny}
        />
      ))}
    </div>
  )
}

function ApprovalRow({
  toolCall: tc,
  onApprove,
  onDeny,
}: {
  toolCall: ToolCallEntry
  onApprove?: (id: string) => void
  onDeny?: (id: string) => void
}) {
  const { t } = useTranslation()
  const summary = extractInputSummary(tc.name, tc.input)
  return (
    <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2">
      <ShieldQuestion className="h-3.5 w-3.5 shrink-0 text-warning" />
      <span className="shrink-0 text-[11px] font-medium text-warning">
        {t("conversation.needConfirm")}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-foreground">
        {toolDisplayName(tc.name, t)}
      </span>
      {summary && (
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
          {summary}
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <Button
          size="sm"
          className="h-7 gap-1.5 rounded-lg bg-success px-2.5 text-xs text-primary-foreground hover:bg-success/90"
          onClick={() => onApprove?.(tc.approvalId!)}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> {t("common.approve")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 rounded-lg border-destructive/30 px-2.5 text-xs text-destructive hover:bg-destructive/10"
          onClick={() => onDeny?.(tc.approvalId!)}
        >
          <X className="h-3.5 w-3.5" /> {t("common.reject")}
        </Button>
      </span>
    </div>
  )
}
