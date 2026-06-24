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
import { useAgentEvents } from "@/hooks/use-agent-events"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import {
  fetchAgents,
  fetchSkills,
  fetchSessions,
  fetchSession,
  fetchTools,
  deleteSession,
  resolveApproval,
} from "@/lib/api"
import type {
  ConversationEntry,
  ToolCallEntry,
  ToolInfo,
  AgentInfo,
  SessionMeta,
  SkillInfo,
  StreamStatus,
} from "@/types/agent"

// ─── App (inner, uses useTheme) ───────────────────────────────────

function AppInner() {
  // Chat state from SSE hook
  const chat = useChat()

  // Theme from context
  const { theme, setTheme } = useTheme()

  // Router
  const location = useLocation()
  const navigate = useNavigate()

  // UI state
  const [agent, setAgent] = useState(() => {
    // Initialize from URL: /agents/:name
    const match = location.pathname.match(/^\/agents\/(.+)$/)
    return match ? decodeURIComponent(match[1]) : ""
  })
  const [selectedToolCallId, setSelectedToolCallId] = useState<string | null>(
    null
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null)

  // Agent management state
  const [agentDetailName, setAgentDetailName] = useState<string | null>(null)
  const [agentEditorName, setAgentEditorName] = useState<string | null>(null)
  const [agentEditorOpen, setAgentEditorOpen] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null)

  // Session replay state
  const [replaySessionId, setReplaySessionId] = useState<string | null>(null)

  // Working directory for file tools
  const [workDir, setWorkDir] = useState<string>("")

  // Data fetched from API
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [sessions, setSessions] = useState<SessionMeta[]>([])

  // ── Fetch agents & tools on mount ──

  const refreshAgents = useCallback(() => {
    fetchAgents()
      .then((raw) => {
        const data = raw ?? []
        setAgents(data)
        if (data.length > 0) {
          // Keep current agent if it still exists, otherwise switch to first
          setAgent((prev) => {
            if (prev && data.find((a) => a.name === prev)) return prev
            return data[0].name
          })
        } else {
          setAgent("")
        }
      })
      .catch(() => {
        setAgents([])
        setAgent("")
      })
  }, [])

  useEffect(() => {
    refreshAgents()
  }, [refreshAgents])

  // Listen for agent file changes (hot-reload).
  useAgentEvents({
    onAgentChange: useCallback(
      (_event) => {
        // Refresh agent list on any change.
        refreshAgents()
        // TODO: show toast notification with event.type and event.name
      },
      [refreshAgents]
    ),
  })

  useEffect(() => {
    fetchTools()
      .then((data) => setTools(data ?? []))
      .catch(() => {
        // Keep empty
      })
    fetchSkills()
      .then((data) => setSkills(data ?? []))
      .catch(() => {
        // Skills endpoint may not be available
      })
  }, [])

  // ── Fetch sessions on mount and after changes ──

  const refreshSessions = useCallback(() => {
    fetchSessions()
      .then((data) => setSessions(data ?? []))
      .catch(() => {
        // Sessions endpoint may not be available
      })
  }, [])

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  // ── Derived state ──

  const agentInfo =
    agents.find((a) => a.name === agent) ?? agents[0] ?? null

  const hasAgents = agents.length > 0 && agentInfo !== null

  const status: StreamStatus = chat.isStreaming
    ? "streaming"
    : chat.error
      ? "error"
      : "idle"

  // ── Handlers ──

  const handleSendMessage = useCallback(
    (text: string) => {
      chat.sendMessage(text, agent, workDir || undefined)
    },
    [chat.sendMessage, agent, workDir]
  )

  const handleSelectToolCall = useCallback(
    (id: string) => {
      setSelectedToolCallId((prev) => (prev === id ? null : id))
      if (!inspectorOpen) setInspectorOpen(true)
    },
    [inspectorOpen]
  )

  const handleSelectAgent = useCallback(
    (name: string) => {
      setAgent(name)
      chat.clear()
      setSelectedToolCallId(null)
      // Sync URL.
      navigate(`/agents/${encodeURIComponent(name)}`, { replace: true })
    },
    [chat.clear, navigate]
  )

  const handleToggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [theme, setTheme])

  const handleThemeChange = useCallback(
    (t: string) => {
      setTheme(t as "dark" | "light" | "system")
    },
    [setTheme]
  )

  const handleNewSession = useCallback(() => {
    chat.clear()
    setSelectedToolCallId(null)
    refreshSessions()
  }, [chat.clear, refreshSessions])

  const handleResumeSession = useCallback(
    async (sessionId: string) => {
      try {
        const sess = await fetchSession(sessionId)
        await chat.loadSession(
          sessionId,
          sess.messages as Array<{
            role: string
            content?: string
            reasoning_content?: string
            tool_calls?: Array<{
              id: string
              name: string
              arguments: unknown
            }>
            tool_call_id?: string
            name?: string
          }>
        )
        setAgent(sess.agent)
        setSelectedToolCallId(null)
      } catch (err) {
        console.error("Failed to resume session:", err)
      }
    },
    [chat.loadSession]
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteSession(sessionId)
        if (chat.sessionId === sessionId) {
          chat.clear()
          setSelectedToolCallId(null)
        }
        refreshSessions()
      } catch (err) {
        console.error("Failed to delete session:", err)
      }
    },
    [chat, refreshSessions]
  )

  const handleApproveTool = useCallback(
    async (approvalId: string) => {
      try {
        await resolveApproval(approvalId, true)
      } catch (err) {
        console.error("Failed to approve tool:", err)
      }
    },
    []
  )

  const handleDenyTool = useCallback(
    async (approvalId: string) => {
      try {
        await resolveApproval(approvalId, false)
      } catch (err) {
        console.error("Failed to deny tool:", err)
      }
    },
    []
  )

  // Agent management handlers
  const handleViewAgent = useCallback((name: string) => {
    setAgentDetailName(name)
  }, [])

  const handleEditAgent = useCallback((name: string) => {
    setAgentEditorName(name)
    setAgentEditorOpen(true)
  }, [])

  const handleCreateAgent = useCallback(() => {
    setAgentEditorName(null)
    setAgentEditorOpen(true)
  }, [])

  const handleDeleteAgent = useCallback((name: string) => {
    setAgentToDelete(name)
  }, [])

  const handleAgentSaved = useCallback(() => {
    refreshAgents()
  }, [refreshAgents])

  const handleAgentDeleted = useCallback(() => {
    refreshAgents()
  }, [refreshAgents])

  // Session replay handler
  const handleReplaySession = useCallback((sessionId: string) => {
    setReplaySessionId(sessionId)
  }, [])

  // ── Keyboard shortcuts ──

  useKeyboardShortcuts({
    onToggleSidebar: () => setSidebarCollapsed((v) => !v),
    onClosePanel: () => {
      if (inspectorOpen && selectedToolCallId) {
        setSelectedToolCallId(null)
      } else if (inspectorOpen) {
        setInspectorOpen(false)
      }
    },
  })

  // ── Selected entry / tool call for inspector panel ──

  const selectedToolCall: ToolCallEntry | null = selectedToolCallId
    ? chat.messages
        .flatMap((m) => m.toolCalls ?? [])
        .find((tc) => tc.id === selectedToolCallId) ?? null
    : null

  const selectedEntry: ConversationEntry | null = selectedToolCallId
    ? chat.messages.find((m) =>
        m.toolCalls?.some((tc) => tc.id === selectedToolCallId)
      ) ?? null
    : null

  return (
    <TooltipProvider delay={300}>
      <AppLayout
        // Sidebar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        agents={agents}
        selectedAgent={agent}
        onSelectAgent={handleSelectAgent}
        tools={tools}
        onSelectTool={setSelectedTool}
        onOpenSettings={() => setSettingsOpen(true)}
        onNewSession={handleNewSession}
        // Sessions
        sessions={sessions}
        activeSessionId={chat.sessionId}
        onResumeSession={handleResumeSession}
        onDeleteSession={handleDeleteSession}
        onReplaySession={handleReplaySession}
        // Agent management
        onViewAgent={handleViewAgent}
        onEditAgent={handleEditAgent}
        onDeleteAgent={handleDeleteAgent}
        onCreateAgent={handleCreateAgent}
        skills={skills}
        // Top bar
        agent={agentInfo ?? { name: "common-agent", provider: "", model: "", tools: [], maxTurns: 10 }}
        status={status}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => {
          setInspectorOpen((v) => {
            if (v) setSelectedToolCallId(null)
            return !v
          })
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        // Panels
        leftPanel={
          <WorkspacePanel
            messages={chat.messages}
            isStreaming={chat.isStreaming}
            error={chat.error}
            onSendMessage={handleSendMessage}
            onStop={chat.abort}
            selectedToolCallId={selectedToolCallId}
            onSelectToolCall={handleSelectToolCall}
            onApproveTool={handleApproveTool}
            onDenyTool={handleDenyTool}
            noAgent={!hasAgents}
            onCreateAgent={handleCreateAgent}
            agentName={agent}
          />
        }
        rightPanel={
          <InspectorPanel entry={selectedEntry} toolCall={selectedToolCall} />
        }
      />

      {/* Dialogs */}
      <ToolDetailDialog
        tool={selectedTool}
        open={!!selectedTool}
        onOpenChange={(open) => {
          if (!open) setSelectedTool(null)
        }}
      />

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        theme={theme}
        onThemeChange={handleThemeChange}
        agents={agents}
        workDir={workDir}
        onWorkDirChange={setWorkDir}
      />

      <AgentDetailDialog
        agentName={agentDetailName}
        open={!!agentDetailName}
        onOpenChange={(open) => {
          if (!open) setAgentDetailName(null)
        }}
        onEdit={(name) => {
          setAgentDetailName(null)
          handleEditAgent(name)
        }}
        onDelete={(name) => {
          setAgentDetailName(null)
          handleDeleteAgent(name)
        }}
      />

      <AgentEditor
        agentName={agentEditorName}
        open={agentEditorOpen}
        onOpenChange={setAgentEditorOpen}
        onSaved={handleAgentSaved}
      />

      <AgentDeleteConfirm
        agentName={agentToDelete}
        open={!!agentToDelete}
        onOpenChange={(open) => {
          if (!open) setAgentToDelete(null)
        }}
        onDeleted={handleAgentDeleted}
      />

      <SessionReplay
        sessionId={replaySessionId}
        open={!!replaySessionId}
        onOpenChange={(open) => {
          if (!open) setReplaySessionId(null)
        }}
      />
    </TooltipProvider>
  )
}

// ─── App (outer, provides ThemeProvider) ──────────────────────────

export function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <AppInner />
    </ThemeProvider>
  )
}

export default App
