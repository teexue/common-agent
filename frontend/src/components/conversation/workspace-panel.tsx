import { useCallback, useMemo, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { AlertCircle, ChevronRight, FileIcon, FilePen, Plus, ShieldCheck, ShieldQuestion, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ActivityEntry } from "./activity-entry"
import { InputBar, type ImageAttachment } from "./input-bar"
import { SearchBar } from "./search-bar"
import { StreamProgress } from "./stream-progress"
import type { SessionTokenUsage } from "./token-usage-indicator"
import { useAutoScroll } from "@/hooks/use-auto-scroll"
import type { MessageSearch } from "@/hooks/use-message-search"
import { optimizePrompt } from "@/lib/api"
import type { ConversationEntry, ToolCallEntry } from "@/types/agent"
import { diffLines } from "@/components/inspector/diff-utils"
import { cn } from "@/lib/utils"
import { toolDisplayName } from "@/lib/tool-i18n"
import { extractInputSummary } from "./tool-summary"

interface WorkspacePanelProps {
  messages: ConversationEntry[]
  isStreaming: boolean
  error: string | null
  onSendMessage: (text: string, images: ImageAttachment[]) => void
  onStop?: () => void
  selectedToolCallId: string | null
  onSelectToolCall: (id: string) => void
  onApproveTool?: (approvalId: string) => void
  onDenyTool?: (approvalId: string) => void
  noAgent?: boolean
  onCreateAgent?: () => void
  agentName?: string
  visionEnabled?: boolean
  search: MessageSearch
  inputAccessory?: React.ReactNode
  tokenUsage?: SessionTokenUsage
}

function EmptyState({
  noAgent,
  onCreateAgent,
}: {
  noAgent?: boolean
  onCreateAgent?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="relative mx-auto mb-5 h-14 w-14">
          <img
            src="/logo.png"
            alt="common-agent logo"
            className="h-full w-full object-contain"
          />
        </div>
        {noAgent ? (
          <>
            <p className="font-heading text-base text-foreground">
              {t("conversation.noAgentTitle")}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              <Trans
                i18nKey="conversation.noAgentDesc"
                components={{
                  code: (
                    <code className="rounded bg-muted px-1 py-0.5 font-mono" />
                  ),
                }}
              />
            </p>
            {onCreateAgent && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5 text-xs"
                onClick={onCreateAgent}
              >
                <Plus className="h-3.5 w-3.5" /> {t("common.createAgent")}
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="font-heading text-base text-foreground">
              {t("conversation.workspaceTitle")}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t("conversation.workspaceDesc")}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function lineCount(s: string): number {
  return s === "" ? 0 : s.split("\n").length
}

/** FileChange records the cumulative line delta for a single modified path. */
interface FileChange {
  path: string
  add: number
  del: number
}

/** computeFileChanges tallies per-file added/deleted lines across all
 * completed write_file / edit_file tool calls in the conversation, preserving
 * first-seen order. */
function computeFileChanges(messages: ConversationEntry[]): FileChange[] {
  const order: string[] = []
  const map = new Map<string, FileChange>()
  for (const msg of messages) {
    for (const tc of msg.toolCalls ?? []) {
      if (tc.status !== "completed") continue
      if (tc.name !== "write_file" && tc.name !== "edit_file") continue
      const obj = (tc.input ?? null) as Record<string, unknown> | null
      if (!obj || typeof obj.path !== "string") continue
      const path = obj.path
      let entry = map.get(path)
      if (!entry) {
        entry = { path, add: 0, del: 0 }
        map.set(path, entry)
        order.push(path)
      }
      if (tc.name === "write_file") {
        entry.add += lineCount(typeof obj.content === "string" ? obj.content : "")
      } else {
        const oldStr = typeof obj.old_string === "string" ? obj.old_string : ""
        const newStr = typeof obj.new_string === "string" ? obj.new_string : ""
        for (const l of diffLines(oldStr, newStr)) {
          if (l.type === "add") entry.add++
          else if (l.type === "del") entry.del++
        }
      }
    }
  }
  return order.map((p) => map.get(p) as FileChange)
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/")
  return idx >= 0 ? path.slice(idx + 1) : path
}

/** collectPendingApprovals gathers tool calls awaiting user approval. */
function collectPendingApprovals(messages: ConversationEntry[]): ToolCallEntry[] {
  const out: ToolCallEntry[] = []
  for (const msg of messages) {
    for (const tc of msg.toolCalls ?? []) {
      if (tc.status === "pending_approval" && tc.approvalId) out.push(tc)
    }
  }
  return out
}

function ApprovalBar({
  messages,
  onApprove,
  onDeny,
}: {
  messages: ConversationEntry[]
  onApprove?: (id: string) => void
  onDeny?: (id: string) => void
}) {
  const { t } = useTranslation()
  const pending = useMemo(() => collectPendingApprovals(messages), [messages])
  if (pending.length === 0) return null
  return (
    <div className="mx-5 mb-1.5 space-y-1.5">
      {pending.map((tc) => {
        const summary = extractInputSummary(tc.name, tc.input)
        return (
          <div
            key={tc.approvalId}
            className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2"
          >
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
      })}
    </div>
  )
}

function FileChangeSummary({ messages }: { messages: ConversationEntry[] }) {
  const { t } = useTranslation()
  const changes = useMemo(() => computeFileChanges(messages), [messages])
  const [open, setOpen] = useState(false)
  if (changes.length === 0) return null
  const files = changes.length
  const add = changes.reduce((s, c) => s + c.add, 0)
  const del = changes.reduce((s, c) => s + c.del, 0)
  return (
    <div className="mx-5 mb-1.5 rounded-xl border border-border bg-card/80 shadow-sm backdrop-blur-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <CollapsibleTrigger
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 transition-transform",
                open && "rotate-90"
              )}
            />
            <FilePen className="h-3 w-3 shrink-0" />
            <span className="font-mono">
              {t("conversation.filesChanged", { count: files })}
            </span>
          </CollapsibleTrigger>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px]">
            {add > 0 && <span className="text-success">+{add}</span>}
            {del > 0 && <span className="text-destructive">-{del}</span>}
          </span>
        </div>
        <CollapsibleContent>
          <div className="max-h-48 overflow-y-auto border-t border-border/50 px-3 py-2">
            <ul className="space-y-px overflow-hidden rounded-md">
              {changes.map((c, idx) => (
                <li
                  key={c.path}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 font-mono text-[11px]",
                    idx % 2 === 1 && "bg-muted/30"
                  )}
                  title={c.path}
                >
                  <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {basename(c.path)}
                  </span>
                  <span className="flex shrink-0 items-center justify-end gap-2 tabular-nums">
                    <span className="w-9 text-right text-success">
                      {c.add > 0 ? `+${c.add}` : ""}
                    </span>
                    <span className="w-9 text-right text-destructive">
                      {c.del > 0 ? `-${c.del}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
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
  noAgent,
  onCreateAgent,
  agentName = "agent",
  visionEnabled,
  search,
  inputAccessory,
  tokenUsage,
}: WorkspacePanelProps) {
  const { containerRef, handleScroll } = useAutoScroll(messages)
  const isEmpty = messages.length === 0 && !error
  const [optimizing, setOptimizing] = useState(false)

  const handleOptimize = useCallback(
    async (text: string) => {
      setOptimizing(true)
      try {
        const result = await optimizePrompt(text, { agent: agentName })
        return result.optimized_prompt
      } finally {
        setOptimizing(false)
      }
    },
    [agentName]
  )
  const {
    searchOpen,
    setSearchQuery,
    currentMatch,
    searchResults,
    matchedIndices,
    matchRefs,
    handlePrev,
    handleNext,
    handleClear,
  } = search

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="h-full overflow-auto"
          >
            {isEmpty ? (
              <EmptyState noAgent={noAgent} onCreateAgent={onCreateAgent} />
            ) : (
              <div className="flex flex-col gap-2.5 px-5 py-4">
                {searchOpen && (
                  <div className="sticky top-0 z-10 -mx-5 bg-background px-5 py-2">
                    <SearchBar
                      onSearch={setSearchQuery}
                      onClear={handleClear}
                      matchCount={searchResults.length}
                      currentMatch={currentMatch}
                      onPrev={handlePrev}
                      onNext={handleNext}
                    />
                  </div>
                )}
                <StreamProgress active={isStreaming} />
                {messages.map((entry, msgIndex) => {
                  const isMatch = matchedIndices.has(msgIndex)
                  const matchIdx = searchResults.findIndex(
                    (r) => r.index === msgIndex
                  )
                  const isCurrent = isMatch && matchIdx === currentMatch
                  const isLast = msgIndex === messages.length - 1
                  return (
                    <div
                      key={entry.id}
                      ref={(el) => {
                        if (el && matchIdx >= 0)
                          matchRefs.current[matchIdx] = el
                      }}
                      className={
                        isCurrent ? "rounded-xl ring-1 ring-primary/40" : ""
                      }
                    >
                      <ActivityEntry
                        entry={entry}
                        selectedToolCallId={selectedToolCallId}
                        onSelectToolCall={onSelectToolCall}
                        onApproveTool={onApproveTool}
                        onDenyTool={onDenyTool}
                        isActive={isStreaming && isLast}
                      />
                    </div>
                  )
                })}
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
      <ApprovalBar
        messages={messages}
        onApprove={onApproveTool}
        onDeny={onDenyTool}
      />
      <FileChangeSummary messages={messages} />
      <InputBar
        onSend={onSendMessage}
        onStop={onStop}
        onOptimize={handleOptimize}
        disabled={noAgent ?? false}
        isStreaming={isStreaming}
        visionEnabled={visionEnabled}
        optimizing={optimizing}
        accessory={inputAccessory}
        tokenUsage={tokenUsage}
      />
    </div>
  )
}
