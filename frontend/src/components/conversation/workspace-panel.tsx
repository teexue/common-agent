import { useEffect, useRef } from "react"
import { AlertCircle, Sparkles } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ActivityEntry } from "./activity-entry"
import { InputBar } from "./input-bar"
import type { ConversationEntry } from "@/types/agent"

interface WorkspacePanelProps {
  messages: ConversationEntry[]
  isStreaming: boolean
  error: string | null
  onSendMessage: (text: string) => void
  onStop?: () => void
  selectedToolCallId: string | null
  onSelectToolCall: (id: string) => void
  onApproveTool?: (approvalId: string) => void
  onDenyTool?: (approvalId: string) => void
}

export function WorkspacePanel({
  messages,
  isStreaming,
  error,
  onSendMessage,
  onStop,
  selectedToolCallId,
  onSelectToolCall,
  onApproveTool,
  onDenyTool,
}: WorkspacePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isEmpty = messages.length === 0 && !error

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Only auto-scroll if user is near the bottom
    const threshold = 150
    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    }
  }, [messages])

  return (
    <div className="flex h-full flex-col">
      {/* Workspace content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div ref={scrollRef} className="h-full overflow-auto">
            {isEmpty ? (
              <div className="flex h-full min-h-[calc(100vh-10rem)] items-center justify-center px-6">
                <div className="max-w-sm text-center">
                  {/* Decorative icon with gradient ring */}
                  <div className="relative mx-auto mb-5 h-14 w-14">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5" />
                    <div className="absolute inset-[3px] flex items-center justify-center rounded-[13px] bg-card">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <p className="font-heading text-base text-foreground">
                    Agent 工作区
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    发送指令开始与 Agent 交互。选择左侧场景可切换不同的工具组合与模型配置。
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5 p-5">
                {messages.map((entry) => (
                  <ActivityEntry
                    key={entry.id}
                    entry={entry}
                    selectedToolCallId={selectedToolCallId}
                    onSelectToolCall={onSelectToolCall}
                    onApproveTool={onApproveTool}
                    onDenyTool={onDenyTool}
                  />
                ))}

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input bar — floating */}
      <InputBar
        onSend={onSendMessage}
        onStop={onStop}
        disabled={false}
        isStreaming={isStreaming}
      />
    </div>
  )
}
