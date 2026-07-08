import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Download, FileJson, FileText, Plus, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ActivityEntry } from "./activity-entry"
import { InputBar } from "./input-bar"
import { SearchBar } from "./search-bar"
import { useAutoScroll } from "@/hooks/use-auto-scroll"
import { exportToMarkdown, exportToJson, downloadFile } from "@/lib/export"
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
  noAgent?: boolean
  onCreateAgent?: () => void
  agentName?: string
}

function EmptyState({ noAgent, onCreateAgent }: { noAgent?: boolean; onCreateAgent?: () => void }) {
  return (
    <div className="flex h-full min-h-[calc(100vh-10rem)] items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="relative mx-auto mb-5 h-14 w-14">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5" />
          <div className="absolute inset-[3px] flex items-center justify-center rounded-[13px] bg-card"><Sparkles className="h-5 w-5 text-primary" /></div>
        </div>
        {noAgent ? (
          <>
            <p className="font-heading text-base text-foreground">尚未配置 Agent</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">创建一个 Agent YAML 配置文件来开始使用。可以通过左侧 Agent 列表的「+」按钮创建，或运行 <code className="rounded bg-muted px-1 py-0.5 font-mono">agent-server config init</code> 进行初始化。</p>
            {onCreateAgent && <Button variant="outline" size="sm" className="mt-4 gap-1.5 rounded-xl text-xs" onClick={onCreateAgent}><Plus className="h-3.5 w-3.5" /> 创建 Agent</Button>}
          </>
        ) : (
          <>
            <p className="font-heading text-base text-foreground">Agent 工作区</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">发送指令开始与 Agent 交互。选择左侧场景可切换不同的工具组合与模型配置。</p>
          </>
        )}
      </div>
    </div>
  )
}

function Toolbar({ searchOpen, onToggleSearch, messages, agentName }: { searchOpen: boolean; onToggleSearch: () => void; messages: ConversationEntry[]; agentName: string }) {
  return (
    <div className="flex justify-end gap-1">
      <Button variant={searchOpen ? "secondary" : "ghost"} size="icon-xs" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={onToggleSearch}>
        <Search className="h-3.5 w-3.5" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" />}>
          <Download className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 rounded-xl">
          <DropdownMenuItem onClick={() => downloadFile(exportToMarkdown(messages, agentName), `${agentName}-${Date.now()}.md`, "text/markdown")} className="gap-2 text-xs"><FileText className="h-3.5 w-3.5" /> 导出 Markdown</DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadFile(exportToJson(messages, agentName), `${agentName}-${Date.now()}.json`, "application/json")} className="gap-2 text-xs"><FileJson className="h-3.5 w-3.5" /> 导出 JSON</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function useMessageSearch(messages: ConversationEntry[]) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentMatch, setCurrentMatch] = useState(0)
  const matchRefs = useRef<HTMLDivElement[]>([])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return messages.map((entry, index) => ({ entry, index })).filter(({ entry }) => {
      const content = entry.content?.toLowerCase() ?? ""
      const reasoning = entry.reasoningContent?.toLowerCase() ?? ""
      const toolNames = entry.toolCalls?.map((tc) => tc.name.toLowerCase()).join(" ") ?? ""
      return content.includes(q) || reasoning.includes(q) || toolNames.includes(q)
    })
  }, [messages, searchQuery])

  const matchedIndices = useMemo(() => new Set(searchResults.map((r) => r.index)), [searchResults])

  useEffect(() => { setCurrentMatch(0) }, [searchQuery])
  useEffect(() => { searchResults.length > 0 && matchRefs.current[currentMatch]?.scrollIntoView({ behavior: "smooth", block: "center" }) }, [currentMatch, searchResults])

  const handlePrev = useCallback(() => setCurrentMatch((p) => p > 0 ? p - 1 : searchResults.length - 1), [searchResults.length])
  const handleNext = useCallback(() => setCurrentMatch((p) => p < searchResults.length - 1 ? p + 1 : 0), [searchResults.length])
  const handleClear = useCallback(() => { setSearchQuery(""); setSearchOpen(false); setCurrentMatch(0); matchRefs.current = [] }, [])

  return { searchOpen, setSearchOpen, searchQuery, setSearchQuery, currentMatch, searchResults, matchedIndices, matchRefs, handlePrev, handleNext, handleClear }
}

export function WorkspacePanel({ messages, isStreaming, error, onSendMessage, onStop, selectedToolCallId, onSelectToolCall, onApproveTool, onDenyTool, noAgent, onCreateAgent, agentName = "agent" }: WorkspacePanelProps) {
  const { containerRef, handleScroll } = useAutoScroll(messages)
  const isEmpty = messages.length === 0 && !error
  const { searchOpen, setSearchOpen, setSearchQuery, currentMatch, searchResults, matchedIndices, matchRefs, handlePrev, handleNext, handleClear } = useMessageSearch(messages)

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-auto">
            {isEmpty ? <EmptyState noAgent={noAgent} onCreateAgent={onCreateAgent} /> : (
              <div className="flex flex-col gap-5 p-5">
                <div className="sticky top-0 z-10 flex flex-col gap-2">
                  <Toolbar searchOpen={searchOpen} onToggleSearch={() => setSearchOpen((v) => !v)} messages={messages} agentName={agentName} />
                  {searchOpen && <SearchBar onSearch={setSearchQuery} onClear={handleClear} matchCount={searchResults.length} currentMatch={currentMatch} onPrev={handlePrev} onNext={handleNext} />}
                </div>
                {messages.map((entry, msgIndex) => {
                  const isMatch = matchedIndices.has(msgIndex)
                  const matchIdx = searchResults.findIndex((r) => r.index === msgIndex)
                  const isCurrent = isMatch && matchIdx === currentMatch
                  const isLast = msgIndex === messages.length - 1
                  return (
                    <div key={entry.id} ref={(el) => { if (el && matchIdx >= 0) matchRefs.current[matchIdx] = el }} className={isCurrent ? "ring-1 ring-primary/40 rounded-xl" : ""}>
                      <ActivityEntry entry={entry} selectedToolCallId={selectedToolCallId} onSelectToolCall={onSelectToolCall} onApproveTool={onApproveTool} onDenyTool={onDenyTool} isActive={isStreaming && isLast} />
                    </div>
                  )
                })}
                {error && <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5 shrink-0" /><span>{error}</span></div>}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      <InputBar onSend={onSendMessage} onStop={onStop} disabled={noAgent ?? false} isStreaming={isStreaming} />
    </div>
  )
}
