import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Bot, ChevronDown, ChevronRight, Minimize2, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTimestamp } from "@/lib/format"
import { MarkdownRenderer } from "@/components/shared/markdown-renderer"
import { ThinkingBlock } from "./thinking-block"
import { ToolCallGroup } from "./tool-call-group"
import type { ConversationEntry } from "@/types/agent"

interface ActivityEntryProps {
  entry: ConversationEntry
  selectedToolCallId: string | null
  onSelectToolCall: (id: string) => void
  onApproveTool?: (approvalId: string) => void
  onDenyTool?: (approvalId: string) => void
  isActive?: boolean
}

function UserMessage({ entry }: { entry: ConversationEntry }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3 px-1">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <User className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">{t("common.you")}</span>
          <span className="text-[11px] text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap rounded-xl bg-muted/50 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">{entry.content}</p>
      </div>
    </div>
  )
}

function AssistantHeader({ entry, isActive }: { entry: ConversationEntry; isActive?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-foreground">Agent</span>
      <span className="text-[11px] text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
      {isActive && (
        <span className="flex items-center gap-1 text-[11px] text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> {t("status.generating")}
        </span>
      )}
      {entry.usage && !isActive && (
        <span className="text-[11px] text-muted-foreground/70">
          {entry.usage.inputTokens.toLocaleString()} in / {entry.usage.outputTokens.toLocaleString()} out
        </span>
      )}
    </div>
  )
}

export function ActivityEntry({ entry, selectedToolCallId, onSelectToolCall, onApproveTool, onDenyTool, isActive }: ActivityEntryProps) {
  const [thinkingExpanded, setThinkingExpanded] = useState(false)

  if (entry.compactionSummary) return <CompactionBanner summary={entry.compactionSummary} />
  if (entry.role === "user") return <UserMessage entry={entry} />

  const hasThinking = !!entry.reasoningContent
  const hasToolCalls = entry.toolCalls && entry.toolCalls.length > 0
  const hasContent = !!entry.content

  return (
    <div className="flex items-start gap-3 px-1">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <AssistantHeader entry={entry} isActive={isActive} />

        {hasThinking && (
          <div className="mt-2">
            <ThinkingBlock content={entry.reasoningContent!} isStreaming={!!isActive} isExpanded={thinkingExpanded} onToggle={() => setThinkingExpanded((v) => !v)} />
          </div>
        )}

        {hasToolCalls && (
          <div className={cn(hasThinking || hasContent ? "mt-2" : "")}>
            <ToolCallGroup
              toolCalls={entry.toolCalls!}
              selectedToolCallId={selectedToolCallId}
              onSelectToolCall={onSelectToolCall}
              onApproveTool={onApproveTool}
              onDenyTool={onDenyTool}
            />
          </div>
        )}

        {hasContent && (
          <div className={cn("mt-2.5 rounded-xl border border-border bg-card p-3.5 text-sm leading-relaxed", isActive && "border-primary/20")}>
            <MarkdownRenderer content={entry.content} isStreaming={!!isActive && !hasToolCalls} />
          </div>
        )}
      </div>
    </div>
  )
}

function CompactionBanner({ summary }: { summary: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mx-1 rounded-xl border border-warning/30 bg-warning/10">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <Minimize2 className="h-3.5 w-3.5 shrink-0 text-warning" />
        <span className="flex-1 text-xs font-medium text-warning">{t("conversation.compaction")}</span>
        {expanded ? <ChevronDown className="h-3 w-3 text-warning/70" /> : <ChevronRight className="h-3 w-3 text-warning/70" />}
      </button>
      {expanded && (
        <div className="border-t border-warning/20 px-3 py-2">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-warning/80">{summary}</p>
        </div>
      )}
    </div>
  )
}
