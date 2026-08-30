import { useState } from "react"
import { useTranslation } from "react-i18next"
import { GitBranch, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { extractInputSummary } from "./tool-summary"
import { SubAgentDialog } from "./sub-agent-dialog"
import type { ToolCallEntry } from "@/types/agent"

function sessionIdOf(tc: ToolCallEntry): string | undefined {
  if (tc.sessionId) return tc.sessionId
  const out = tc.output
  if (!out || typeof out !== "object" || Array.isArray(out)) return
  const sid = (out as Record<string, unknown>).session_id
  return typeof sid === "string" && sid ? sid : undefined
}

function isLive(status: string): boolean {
  return status === "running" || status === "sub_agent_running"
}

export function SubAgentCard({ toolCall }: { toolCall: ToolCallEntry }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const live = isLive(toolCall.status)
  const summary = extractInputSummary(toolCall.name, toolCall.input)
  const label = live ? t("status.delegating") : t("subAgent.clickToView")
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-auto w-full justify-start gap-1.5 rounded-lg px-2 py-1 text-left font-mono text-[10px] text-muted-foreground hover:text-foreground"
      >
        {live ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-chart-2" />
        ) : (
          <GitBranch className="h-3 w-3 shrink-0 text-chart-2" />
        )}
        <span className="shrink-0 text-foreground">{t("subAgent.title")}</span>
        {summary && <span className="min-w-0 flex-1 truncate">{summary}</span>}
        <span className={cn("ml-auto shrink-0 text-[10px] text-chart-2")}>
          {label}
        </span>
      </Button>
      <SubAgentDialog
        open={open}
        onOpenChange={setOpen}
        sessionId={sessionIdOf(toolCall)}
        live={live}
      />
    </>
  )
}
