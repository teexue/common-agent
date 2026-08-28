import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronRight, Minimize2 } from "lucide-react"
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
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-accent via-primary/10 to-primary/25 px-3.5 py-2 shadow-md shadow-primary/15">
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
          {entry.content}
        </p>
      </div>
    </div>
  )
}

function GeneratingPulse() {
  const { t } = useTranslation()
  return (
    <span className="flex items-center gap-1 text-[11px] text-primary">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
      {t("status.generating")}
    </span>
  )
}

export function ActivityEntry({
  entry,
  selectedToolCallId,
  onSelectToolCall,
  onApproveTool,
  onDenyTool,
  isActive,
}: ActivityEntryProps) {
  const [thinkingExpanded, setThinkingExpanded] = useState(false)

  if (entry.compactionSummary)
    return <CompactionBanner summary={entry.compactionSummary} />
  if (entry.role === "user") return <UserMessage entry={entry} />

  const hasThinking = !!entry.reasoningContent
  const hasToolCalls = entry.toolCalls && entry.toolCalls.length > 0
  const hasContent = !!entry.content
  const isWaiting =
    !!isActive && !hasContent && !hasThinking && !hasToolCalls

  return (
    <div className="flex flex-col gap-1.5">
      {isActive && <GeneratingPulse />}

      {hasThinking && (
        <ThinkingBlock
          content={entry.reasoningContent!}
          isStreaming={!!isActive}
          isExpanded={thinkingExpanded}
          onToggle={() => setThinkingExpanded((v) => !v)}
        />
      )}

      {hasToolCalls && (
        <ToolCallGroup
          toolCalls={entry.toolCalls!}
          selectedToolCallId={selectedToolCallId}
          onSelectToolCall={onSelectToolCall}
          onApproveTool={onApproveTool}
          onDenyTool={onDenyTool}
        />
      )}

      {hasContent && (
        <div className="text-[13px] leading-relaxed">
          <MarkdownRenderer
            content={entry.content}
            isStreaming={!!isActive && !hasToolCalls}
          />
        </div>
      )}

      {isWaiting && (
        <div className="flex flex-col gap-1.5" aria-hidden>
          <div className="shimmer-line" />
          <div className="shimmer-line" />
          <div className="shimmer-line" />
        </div>
      )}
    </div>
  )
}

function CompactionBanner({ summary }: { summary: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Minimize2 className="h-3.5 w-3.5 shrink-0 text-warning" />
        <span className="flex-1 text-xs font-medium text-warning">
          {t("conversation.compaction")}
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-warning/70" />
        ) : (
          <ChevronRight className="h-3 w-3 text-warning/70" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-warning/20 px-3 py-2">
          <p className="text-xs leading-relaxed whitespace-pre-wrap text-warning/80">
            {summary}
          </p>
        </div>
      )}
    </div>
  )
}
