import { useState } from "react"
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
  return (
    <div className="flex items-start gap-3 px-1">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <User className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-heading text-xs text-foreground">你</span>
          <span className="text-[10px] text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{entry.content}</p>
      </div>
    </div>
  )
}

function AssistantHeader({ entry, isActive }: { entry: ConversationEntry; isActive?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-heading text-xs text-foreground">Agent</span>
      <span className="text-[10px] text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
      {isActive && (
        <span className="flex items-center gap-1 text-[10px] text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> 生成中
        </span>
      )}
      {entry.usage && !isActive && (
        <span className="text-[10px] text-muted-foreground/60">
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
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mx-1 rounded-xl border border-amber-200/50 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-950/20">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <Minimize2 className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="flex-1 text-xs font-medium text-amber-700 dark:text-amber-300">上下文已压缩</span>
        {expanded ? <ChevronDown className="h-3 w-3 text-amber-500" /> : <ChevronRight className="h-3 w-3 text-amber-500" />}
      </button>
      {expanded && (
        <div className="border-t border-amber-200/50 px-3 py-2 dark:border-amber-800/30">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-amber-800/80 dark:text-amber-200/70">{summary}</p>
        </div>
      )}
    </div>
  )
}
