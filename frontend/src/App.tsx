import { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { AppLayout } from "@/components/layout/app-layout"
import { WorkspacePanel } from "@/components/conversation/workspace-panel"
import { InspectorPanel } from "@/components/inspector/inspector-panel"
import { ToolDetailDialog } from "@/components/tools/tool-detail-dialog"
import { SettingsSheet } from "@/components/settings/settings-sheet"
import { AgentDetailDialog } from "@/components/agents/agent-detail-dialog"
import { AgentEditor } from "@/components/agents/agent-editor"
import { AgentDeleteConfirm } from "@/components/agents/agent-delete-confirm"
import { SessionReplay } from "@/components/sessions/session-replay"
import { useChat } from "@/hooks/use-chat"
import { useAgentManager } from "@/hooks/use-agent-manager"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { fetchSkills, fetchSessions, fetchSession, fetchTools, deleteSession, resolveApproval } from "@/lib/api"
import type { ConversationEntry, ToolCallEntry, ToolInfo, SessionMeta, SkillInfo, StreamStatus } from "@/types/agent"

function AppDialogs({ agentMgr, selectedTool, setSelectedTool, settingsOpen, setSettingsOpen, theme, handleThemeChange, agents, workDir, setWorkDir, replaySessionId, setReplaySessionId }: {
  agentMgr: ReturnType<typeof useAgentManager>
  selectedTool: ToolInfo | null; setSelectedTool: (t: ToolInfo | null) => void
  settingsOpen: boolean; setSettingsOpen: (v: boolean) => void
  theme: string; handleThemeChange: (t: string) => void
  agents: ReturnType<typeof useAgentManager>["agents"]
  workDir: string; setWorkDir: (v: string) => void
  replaySessionId: string | null; setReplaySessionId: (v: string | null) => void
}) {
  return (
    <>
      <ToolDetailDialog tool={selectedTool} open={!!selectedTool} onOpenChange={(open) => { if (!open) setSelectedTool(null) }} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} theme={theme} onThemeChange={handleThemeChange} agents={agents} workDir={workDir} onWorkDirChange={setWorkDir} />
      <AgentDetailDialog agentName={agentMgr.agentDetailName} open={!!agentMgr.agentDetailName} onOpenChange={(open) => { if (!open) agentMgr.setAgentDetailName(null) }} onEdit={(name) => { agentMgr.setAgentDetailName(null); agentMgr.handleEditAgent(name) }} onDelete={(name) => { agentMgr.setAgentDetailName(null); agentMgr.handleDeleteAgent(name) }} />
      <AgentEditor agentName={agentMgr.agentEditorName} open={agentMgr.agentEditorOpen} onOpenChange={agentMgr.setAgentEditorOpen} onSaved={agentMgr.handleAgentSaved} />
      <AgentDeleteConfirm agentName={agentMgr.agentToDelete} open={!!agentMgr.agentToDelete} onOpenChange={(open) => { if (!open) agentMgr.setAgentToDelete(null) }} onDeleted={agentMgr.handleAgentDeleted} />
      <SessionReplay sessionId={replaySessionId} open={!!replaySessionId} onOpenChange={(open) => { if (!open) setReplaySessionId(null) }} />
    </>
  )
}

function useSessions(chat: ReturnType<typeof useChat>) {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const refresh = useCallback(() => { fetchSessions().then((d) => setSessions(d ?? [])).catch(() => {}) }, [])
  useEffect(() => { refresh() }, [refresh])
  const resume = useCallback(async (id: string) => {
    try {
      const sess = await fetchSession(id)
      await chat.loadSession(id, sess.messages as Array<{ role: string; content?: string; reasoning_content?: string; tool_calls?: Array<{ id: string; name: string; arguments: unknown }>; tool_call_id?: string; name?: string }>)
      return sess.agent
    } catch (err) { console.error("Failed to resume session:", err); return null }
  }, [chat.loadSession])
  const remove = useCallback(async (id: string) => {
    try { await deleteSession(id); if (chat.sessionId === id) chat.clear(); refresh() } catch (err) { console.error("Failed to delete session:", err) }
  }, [chat, refresh])
  return { sessions, refresh, resume, remove }
}

function AppInner() {
  const chat = useChat()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const sessMgr = useSessions(chat)

  const [agent, setAgent] = useState(() => { const m = location.pathname.match(/^\/agents\/(.+)$/); return m ? decodeURIComponent(m[1]) : "" })
  const [selectedToolCallId, setSelectedToolCallId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null)
  const [replaySessionId, setReplaySessionId] = useState<string | null>(null)
  const [workDir, setWorkDir] = useState("")
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [skills, setSkills] = useState<SkillInfo[]>([])

  const agentMgr = useAgentManager({ onAgentsChanged: useCallback(() => { setAgent((p) => { if (p && agentMgr.agents.find((a) => a.name === p)) return p; return agentMgr.agents[0]?.name ?? "" }) }, []) })
  const { agents } = agentMgr

  useEffect(() => { fetchTools().then((d) => setTools(d ?? [])).catch(() => {}); fetchSkills().then((d) => setSkills(d ?? [])).catch(() => {}) }, [])

  const agentInfo = agents.find((a) => a.name === agent) ?? agents[0] ?? null
  const hasAgents = agents.length > 0 && agentInfo !== null
  const status: StreamStatus = chat.isStreaming ? "streaming" : chat.error ? "error" : "idle"

  const handleSendMessage = useCallback((text: string) => chat.sendMessage(text, agent, workDir || undefined), [chat.sendMessage, agent, workDir])
  const handleSelectToolCall = useCallback((id: string) => { setSelectedToolCallId((p) => (p === id ? null : id)); if (!inspectorOpen) setInspectorOpen(true) }, [inspectorOpen])
  const handleSelectAgent = useCallback((name: string) => { setAgent(name); chat.clear(); setSelectedToolCallId(null); navigate(`/agents/${encodeURIComponent(name)}`, { replace: true }) }, [chat.clear, navigate])
  const handleToggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme])
  const handleNewSession = useCallback(() => { chat.clear(); setSelectedToolCallId(null); sessMgr.refresh() }, [chat.clear, sessMgr.refresh])
  const handleResumeSession = useCallback(async (id: string) => { const a = await sessMgr.resume(id); if (a) { setAgent(a); setSelectedToolCallId(null) } }, [sessMgr.resume])
  const resolveToolApproval = useCallback(async (id: string, approve: boolean) => { try { await resolveApproval(id, approve) } catch (e) { console.error(e) } }, [])
  const handleReplaySession = useCallback((id: string) => setReplaySessionId(id), [])

  useKeyboardShortcuts({ onToggleSidebar: () => setSidebarCollapsed((v) => !v), onClosePanel: () => { if (inspectorOpen && selectedToolCallId) setSelectedToolCallId(null); else if (inspectorOpen) setInspectorOpen(false) } })

  const selectedToolCall: ToolCallEntry | null = selectedToolCallId ? chat.messages.flatMap((m) => m.toolCalls ?? []).find((tc) => tc.id === selectedToolCallId) ?? null : null
  const selectedEntry: ConversationEntry | null = selectedToolCallId ? chat.messages.find((m) => m.toolCalls?.some((tc) => tc.id === selectedToolCallId)) ?? null : null

  return (
    <TooltipProvider delay={300}>
      <AppLayout
        sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        agents={agents} selectedAgent={agent} onSelectAgent={handleSelectAgent}
        tools={tools} onSelectTool={setSelectedTool} onOpenSettings={() => setSettingsOpen(true)} onNewSession={handleNewSession}
        sessions={sessMgr.sessions} activeSessionId={chat.sessionId} onResumeSession={handleResumeSession} onDeleteSession={sessMgr.remove} onReplaySession={handleReplaySession}
        onViewAgent={agentMgr.handleViewAgent} onEditAgent={agentMgr.handleEditAgent} onDeleteAgent={agentMgr.handleDeleteAgent} onCreateAgent={agentMgr.handleCreateAgent} skills={skills}
        agent={agentInfo ?? { name: "common-agent", provider: "", model: "", tools: [], maxTurns: 10 }}
        status={status} inspectorOpen={inspectorOpen}
        onToggleInspector={() => { setInspectorOpen((v) => { if (v) setSelectedToolCallId(null); return !v }) }}
        theme={theme} onToggleTheme={handleToggleTheme}
        leftPanel={<WorkspacePanel messages={chat.messages} isStreaming={chat.isStreaming} error={chat.error} onSendMessage={handleSendMessage} onStop={chat.abort} selectedToolCallId={selectedToolCallId} onSelectToolCall={handleSelectToolCall} onApproveTool={(id) => resolveToolApproval(id, true)} onDenyTool={(id) => resolveToolApproval(id, false)} noAgent={!hasAgents} onCreateAgent={agentMgr.handleCreateAgent} agentName={agent} />}
        rightPanel={<InspectorPanel entry={selectedEntry} toolCall={selectedToolCall} />}
      />
      <AppDialogs agentMgr={agentMgr} selectedTool={selectedTool} setSelectedTool={setSelectedTool} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} theme={theme} handleThemeChange={(t) => setTheme(t as "dark" | "light" | "system")} agents={agents} workDir={workDir} setWorkDir={setWorkDir} replaySessionId={replaySessionId} setReplaySessionId={setReplaySessionId} />
    </TooltipProvider>
  )
}

export function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <AppInner />
    </ThemeProvider>
  )
}

export default App
