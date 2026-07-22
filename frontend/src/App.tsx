import { useCallback, useEffect, useState } from "react"
import { Route, Routes, useLocation, useNavigate, useParams, Navigate } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { BackgroundProvider } from "@/components/background/background-provider"
import { AppLayout } from "@/components/layout/app-layout"
import { WorkspacePanel } from "@/components/conversation/workspace-panel"
import { InspectorPanel } from "@/components/inspector/inspector-panel"
import { ToolDetailDialog } from "@/components/tools/tool-detail-dialog"
import { SettingsPage } from "@/components/settings/settings-page"
import { ManagePage } from "@/components/manage/manage-page"
import { AgentDetailDialog } from "@/components/agents/agent-detail-dialog"
import { AgentEditorPage } from "@/components/agents/agent-editor"
import { AgentDeleteConfirm } from "@/components/agents/agent-delete-confirm"
import { SessionReplay } from "@/components/sessions/session-replay"
import { useChat } from "@/hooks/use-chat"
import { useAgentManager } from "@/hooks/use-agent-manager"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { fetchSessions, fetchSession, deleteSession, resolveApproval, fetchProviders } from "@/lib/api"
import type { ConversationEntry, ToolCallEntry, ToolInfo, SessionMeta, StreamStatus, ProviderInfo } from "@/types/agent"

function AppDialogs({ agentMgr, selectedTool, setSelectedTool, replaySessionId, setReplaySessionId, onEditAgent }: {
  agentMgr: ReturnType<typeof useAgentManager>
  selectedTool: ToolInfo | null; setSelectedTool: (t: ToolInfo | null) => void
  replaySessionId: string | null; setReplaySessionId: (v: string | null) => void
  onEditAgent?: (id: string) => void
}) {
  return (
    <>
      <ToolDetailDialog tool={selectedTool} open={!!selectedTool} onOpenChange={(open) => { if (!open) setSelectedTool(null) }} />
      <AgentDetailDialog
        agentId={agentMgr.agentDetailName}
        open={!!agentMgr.agentDetailName}
        onOpenChange={(open) => { if (!open) agentMgr.setAgentDetailName(null) }}
        onEdit={(id) => { agentMgr.setAgentDetailName(null); onEditAgent?.(id) }}
        onDelete={(id) => { agentMgr.setAgentDetailName(null); agentMgr.handleDeleteAgent(id) }}
      />
      <AgentDeleteConfirm agentId={agentMgr.agentToDelete} open={!!agentMgr.agentToDelete} onOpenChange={(open) => { if (!open) agentMgr.setAgentToDelete(null) }} onDeleted={agentMgr.handleAgentDeleted} />
      <SessionReplay sessionId={replaySessionId} open={!!replaySessionId} onOpenChange={(open) => { if (!open) setReplaySessionId(null) }} />
    </>
  )
}

function useSessionList() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const refresh = useCallback(() => { fetchSessions().then((d) => setSessions(d ?? [])).catch(() => {}) }, [])
  useEffect(() => { refresh() }, [refresh])
  const remove = useCallback(async (id: string) => {
    try { await deleteSession(id); refresh() } catch (err) { console.error("Failed to delete session:", err) }
  }, [refresh])
  return { sessions, refresh, remove }
}

function useSessions(chat: ReturnType<typeof useChat>) {
  const list = useSessionList()
  const resume = useCallback(async (id: string) => {
    try {
      const sess = await fetchSession(id)
      await chat.loadSession(id, sess.messages as Array<{ role: string; content?: string; reasoning_content?: string; tool_calls?: Array<{ id: string; name: string; arguments: unknown }>; tool_call_id?: string; name?: string }>)
      return sess.agent
    } catch (err) { console.error("Failed to resume session:", err); return null }
  }, [chat.loadSession])
  const remove = useCallback(async (id: string) => {
    try {
      await deleteSession(id)
      if (chat.sessionId === id) chat.clear()
      list.refresh()
    } catch (err) { console.error("Failed to delete session:", err) }
  }, [chat, list.refresh])
  return { sessions: list.sessions, refresh: list.refresh, resume, remove }
}

function useShellNav() {
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const sessList = useSessionList()
  const [replaySessionId, setReplaySessionId] = useState<string | null>(null)

  useKeyboardShortcuts({
    onToggleSidebar: () => setSidebarCollapsed((v) => !v),
    onClosePanel: () => {},
  })

  const handleResumeSession = useCallback(async (id: string) => {
    try {
      const sess = await fetchSession(id)
      navigate(`/agents/${encodeURIComponent(sess.agent)}?resume=${encodeURIComponent(id)}`)
    } catch (err) {
      console.error("Failed to resume session:", err)
    }
  }, [navigate])

  return {
    navigate,
    sidebarCollapsed,
    setSidebarCollapsed,
    onToggleSidebar: () => setSidebarCollapsed((v) => !v),
    onOpenSettings: () => navigate("/settings"),
    onOpenManage: () => navigate("/manage"),
    onNewSession: () => navigate("/"),
    sessions: sessList.sessions,
    onResumeSession: handleResumeSession,
    onDeleteSession: sessList.remove,
    onReplaySession: (id: string) => setReplaySessionId(id),
    replaySessionId,
    setReplaySessionId,
  }
}

function WorkspaceRoute() {
  const chat = useChat()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const sessMgr = useSessions(chat)

  const [agent, setAgent] = useState(() => { const m = location.pathname.match(/^\/agents\/(.+)$/); return m ? decodeURIComponent(m[1]) : "" })
  const [selectedToolCallId, setSelectedToolCallId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [replaySessionId, setReplaySessionId] = useState<string | null>(null)
  const workDir = localStorage.getItem("workDir") || ""
  const [providers, setProviders] = useState<ProviderInfo[]>([])

  const agentMgr = useAgentManager()
  const { agents } = agentMgr

  useEffect(() => { fetchProviders().then((d) => setProviders(d ?? [])).catch(() => {}) }, [])
  useEffect(() => { if (chat.sessionId) sessMgr.refresh() }, [chat.sessionId, sessMgr.refresh])
  useEffect(() => {
    if (agents.length === 0) return
    setAgent((prev) => {
      if (prev && agents.some((a) => a.id === prev || a.name === prev)) {
        const match = agents.find((a) => a.id === prev || a.name === prev)
        return match?.id || prev
      }
      return agents[0].id || agents[0].name
    })
  }, [agents])

  // Resume session when navigated from manage/settings with ?resume=
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const resumeId = params.get("resume")
    if (!resumeId) return
    let cancelled = false
    ;(async () => {
      const a = await sessMgr.resume(resumeId)
      if (cancelled || !a) return
      setAgent(a)
      setSelectedToolCallId(null)
      navigate(`/agents/${encodeURIComponent(a)}`, { replace: true })
    })()
    return () => { cancelled = true }
  }, [location.search]) // eslint-disable-line react-hooks/exhaustive-deps

  const agentInfo = agents.find((a) => a.id === agent || a.name === agent) ?? agents[0] ?? null
  const hasAgents = agents.length > 0 && agentInfo !== null
  const agentLocked = chat.messages.length > 0
  const status: StreamStatus = chat.isStreaming ? "streaming" : chat.error ? "error" : "idle"
  const visionEnabled = agentInfo ? (providers.find((p) => p.name === agentInfo.provider)?.vision ?? false) : false

  const handleSendMessage = useCallback((text: string, images?: { dataUrl: string; name: string }[]) => chat.sendMessage(text, agentInfo?.id || agent || agentInfo?.name || "", workDir || undefined, images), [chat.sendMessage, agent, agentInfo, workDir])
  const handleSelectToolCall = useCallback((id: string) => { setSelectedToolCallId((p) => (p === id ? null : id)); if (!inspectorOpen) setInspectorOpen(true) }, [inspectorOpen])
  const handleSelectAgent = useCallback((id: string) => {
    if (chat.messages.length > 0) return
    setAgent(id)
    setSelectedToolCallId(null)
    navigate(`/agents/${encodeURIComponent(id)}`, { replace: true })
  }, [chat.messages.length, navigate])
  const handleToggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme])
  const handleNewSession = useCallback(() => { chat.clear(); setSelectedToolCallId(null); sessMgr.refresh() }, [chat.clear, sessMgr.refresh])
  const handleResumeSession = useCallback(async (id: string) => {
    const a = await sessMgr.resume(id)
    if (a) {
      setAgent(a)
      setSelectedToolCallId(null)
      navigate(`/agents/${encodeURIComponent(a)}`, { replace: true })
    }
  }, [sessMgr.resume, navigate])
  const resolveToolApproval = useCallback(async (id: string, approve: boolean) => { try { await resolveApproval(id, approve) } catch (e) { console.error(e) } }, [])
  const handleReplaySession = useCallback((id: string) => setReplaySessionId(id), [])

  useKeyboardShortcuts({
    onToggleSidebar: () => setSidebarCollapsed((v) => !v),
    onClosePanel: () => {
      if (inspectorOpen && selectedToolCallId) setSelectedToolCallId(null)
      else if (inspectorOpen) setInspectorOpen(false)
    },
  })

  const selectedToolCall: ToolCallEntry | null = selectedToolCallId ? chat.messages.flatMap((m) => m.toolCalls ?? []).find((tc) => tc.id === selectedToolCallId) ?? null : null
  const selectedEntry: ConversationEntry | null = selectedToolCallId ? chat.messages.find((m) => m.toolCalls?.some((tc) => tc.id === selectedToolCallId)) ?? null : null

  return (
    <TooltipProvider delay={300}>
      <AppLayout
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        onOpenSettings={() => navigate("/settings")}
        onOpenManage={() => navigate("/manage")}
        onNewSession={handleNewSession}
        sessions={sessMgr.sessions}
        activeSessionId={chat.sessionId}
        onResumeSession={handleResumeSession}
        onDeleteSession={sessMgr.remove}
        onReplaySession={handleReplaySession}
        agent={agentInfo ?? { id: "", name: "common-agent", provider: "", model: "", tools: [], maxTurns: 10 }}
        agents={agents}
        agentLocked={agentLocked}
        onSelectAgent={handleSelectAgent}
        status={status}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => { setInspectorOpen((v) => { if (v) setSelectedToolCallId(null); return !v }) }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        showInspector
        leftPanel={
          <WorkspacePanel
            messages={chat.messages}
            isStreaming={chat.isStreaming}
            error={chat.error}
            onSendMessage={handleSendMessage}
            onStop={chat.abort}
            selectedToolCallId={selectedToolCallId}
            onSelectToolCall={handleSelectToolCall}
            onApproveTool={(id) => resolveToolApproval(id, true)}
            onDenyTool={(id) => resolveToolApproval(id, false)}
            noAgent={!hasAgents}
            onCreateAgent={() => navigate("/manage/agents/new")}
            agentName={agentInfo?.name || agent}
            visionEnabled={visionEnabled}
          />
        }
        rightPanel={<InspectorPanel entry={selectedEntry} toolCall={selectedToolCall} />}
      />
      <AppDialogs
        agentMgr={agentMgr}
        selectedTool={null}
        setSelectedTool={() => {}}
        replaySessionId={replaySessionId}
        setReplaySessionId={setReplaySessionId}
        onEditAgent={(id) => navigate(`/manage/agents/${encodeURIComponent(id)}/edit`)}
      />
    </TooltipProvider>
  )
}

function shellLayoutProps(shell: ReturnType<typeof useShellNav>, theme: string, setTheme: (t: "dark" | "light" | "system") => void) {
  return {
    sidebarCollapsed: shell.sidebarCollapsed,
    onToggleSidebar: shell.onToggleSidebar,
    onOpenSettings: shell.onOpenSettings,
    onOpenManage: shell.onOpenManage,
    onNewSession: shell.onNewSession,
    sessions: shell.sessions,
    onResumeSession: shell.onResumeSession,
    onDeleteSession: shell.onDeleteSession,
    onReplaySession: shell.onReplaySession,
    agent: { id: "", name: "common-agent", provider: "", model: "", tools: [] as string[], maxTurns: 10 },
    status: "idle" as const,
    inspectorOpen: false,
    onToggleInspector: () => {},
    theme,
    onToggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    showInspector: false as const,
  }
}

function ManageRoute() {
  const { theme, setTheme } = useTheme()
  const shell = useShellNav()
  const navigate = useNavigate()
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null)
  const [agentsRefreshKey, setAgentsRefreshKey] = useState(0)

  const agentMgr = useAgentManager({
    onAgentsChanged: useCallback(() => setAgentsRefreshKey((k) => k + 1), []),
  })

  return (
    <TooltipProvider delay={300}>
      <AppLayout
        {...shellLayoutProps(shell, theme, setTheme)}
        leftPanel={
          <ManagePage
            onViewAgent={agentMgr.handleViewAgent}
            onEditAgent={(id) => navigate(`/manage/agents/${encodeURIComponent(id)}/edit`)}
            onDeleteAgent={agentMgr.handleDeleteAgent}
            onCreateAgent={() => navigate("/manage/agents/new")}
            onSelectTool={setSelectedTool}
            agentsRefreshKey={agentsRefreshKey}
          />
        }
      />
      <AppDialogs
        agentMgr={agentMgr}
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        replaySessionId={shell.replaySessionId}
        setReplaySessionId={shell.setReplaySessionId}
        onEditAgent={(id) => navigate(`/manage/agents/${encodeURIComponent(id)}/edit`)}
      />
    </TooltipProvider>
  )
}

function AgentEditorRoute({ mode }: { mode: "create" | "edit" }) {
  const { theme, setTheme } = useTheme()
  const shell = useShellNav()
  const navigate = useNavigate()
  const { agentId } = useParams<{ agentId: string }>()
  const id = mode === "edit" ? decodeURIComponent(agentId || "") : null

  return (
    <TooltipProvider delay={300}>
      <AppLayout
        {...shellLayoutProps(shell, theme, setTheme)}
        leftPanel={
          <AgentEditorPage
            agentId={id}
            onBack={() => navigate("/manage")}
            onSaved={() => navigate("/manage")}
          />
        }
      />
      <SessionReplay
        sessionId={shell.replaySessionId}
        open={!!shell.replaySessionId}
        onOpenChange={(open) => { if (!open) shell.setReplaySessionId(null) }}
      />
    </TooltipProvider>
  )
}

function SettingsRoute() {
  const { theme, setTheme } = useTheme()
  const shell = useShellNav()

  return (
    <TooltipProvider delay={300}>
      <AppLayout
        {...shellLayoutProps(shell, theme, setTheme)}
        onOpenSettings={() => {}}
        leftPanel={<SettingsPage />}
      />
      <SessionReplay
        sessionId={shell.replaySessionId}
        open={!!shell.replaySessionId}
        onOpenChange={(open) => { if (!open) shell.setReplaySessionId(null) }}
      />
    </TooltipProvider>
  )
}

export function App() {
  return (
    <ThemeProvider defaultMode="dark">
      <BackgroundProvider>
        <Routes>
        <Route path="/settings" element={<SettingsRoute />} />
        <Route path="/manage" element={<ManageRoute />} />
        <Route path="/manage/agents/new" element={<AgentEditorRoute mode="create" />} />
        <Route path="/manage/agents/:agentId/edit" element={<AgentEditorRoute mode="edit" />} />
        <Route path="/agents/:agentName" element={<WorkspaceRoute />} />
        <Route path="/" element={<WorkspaceRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BackgroundProvider>
    </ThemeProvider>
  )
}

export default App
