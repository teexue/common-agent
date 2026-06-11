import { useState } from "react"
import { Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTimestamp } from "@/lib/format"
import { MarkdownRenderer } from "@/components/shared/markdown-renderer"
import { ThinkingBlock } from "./thinking-block"
import { ToolOperationCard } from "./tool-operation-card"
import type { ConversationEntry } from "@/types/agent"

interface ActivityEntryProps {
  entry: ConversationEntry
  selectedToolCallId: string | null
  onSelectToolCall: (id: string) => void
}

export function ActivityEntry({
  entry,
  selectedToolCallId,
  onSelectToolCall,
}: ActivityEntryProps) {
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const isUser = entry.role === "user"

  // User messages: compact header row
  if (isUser) {
    return (
      <div className="flex items-start gap-3 px-1">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <User className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-heading text-xs text-foreground">你</span>
            <span className="text-[10px] text-muted-foreground">
              {formatTimestamp(entry.timestamp)}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {entry.content}
          </p>
        </div>
      </div>
    )
  }

  // Assistant messages: activity group
  const hasThinking = !!entry.reasoningContent
  const hasToolCalls = entry.toolCalls && entry.toolCalls.length > 0
  const hasContent = !!entry.content

  return (
    <div className="flex items-start gap-3 px-1">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="font-heading text-xs text-foreground">
            Agent
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatTimestamp(entry.timestamp)}
          </span>
          {entry.isStreaming && (
            <span className="flex items-center gap-1 text-[10px] text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              生成中
            </span>
          )}
        </div>

        {/* Thinking block */}
        {hasThinking && (
          <div className="mt-2">
            <ThinkingBlock
              content={entry.reasoningContent!}
              isStreaming={!!entry.isStreaming}
              isExpanded={thinkingExpanded}
              onToggle={() => setThinkingExpanded((v) => !v)}
            />
          </div>
        )}

        {/* Tool operations */}
        {hasToolCalls && (
          <div
            className={cn(
              "flex flex-col gap-1.5",
              hasThinking || hasContent ? "mt-2" : ""
            )}
          >
            {entry.toolCalls!.map((tc) => (
              <ToolOperationCard
                key={tc.id}
                toolCall={tc}
                isSelected={selectedToolCallId === tc.id}
                onSelect={() => onSelectToolCall(tc.id)}
              />
            ))}
          </div>
        )}

        {/* Text content */}
        {hasContent && (
          <div
            className={cn(
              "mt-2.5 rounded-xl border border-border bg-card p-3.5 text-sm leading-relaxed",
              entry.isStreaming && "border-primary/20"
            )}
          >
            <MarkdownRenderer
              content={entry.content}
              isStreaming={!!entry.isStreaming}
            />
          </div>
        )}
      </div>
    </div>
  )
}
