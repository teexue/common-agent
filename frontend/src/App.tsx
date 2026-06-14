import { useCallback, useEffect, useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppLayout } from "@/components/layout/app-layout"
import { WorkspacePanel } from "@/components/conversation/workspace-panel"
import { InspectorPanel } from "@/components/inspector/inspector-panel"
import { ToolDetailDialog } from "@/components/tools/tool-detail-dialog"
import { SettingsSheet } from "@/components/settings/settings-sheet"
import { useChat } from "@/hooks/use-chat"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { fetchAgents, fetchSessions, fetchSession, fetchTools, deleteSession, resolveApproval } from "@/lib/api"
import type {
  ConversationEntry,
  ToolCallEntry,
  ToolInfo,
  AgentInfo,
  SessionMeta,
  StreamStatus,
} from "@/types/agent"

// ─── Default / Fallback Data ──────────────────────────────────────

const DEFAULT_AGENT: AgentInfo = {
  name: "general-chat",
  provider: "",
  model: "",
  tools: [],
  maxTurns: 10,
}

// ─── App ──────────────────────────────────────────────────────────

export function App() {
  // Chat state from SSE hook
  const chat = useChat()

  // UI state
  const [agent, setAgent] = useState("general-chat")
  const [selectedToolCallId, setSelectedToolCallId] = useState<string | null>(
    null
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [theme, setTheme] = useState<string>("dark")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null)

  // Data fetched from API
  const [agents, setAgents] = useState<AgentInfo[]>([
    DEFAULT_AGENT,
  ])
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [sessions, setSessions] = useState<SessionMeta[]>([])

  // ── Fetch agents & tools on mount ──

  useEffect(() => {
    fetchAgents()
      .then((data: AgentInfo[]) => {
        if (data.length > 0) {
          setAgents(data)
          setAgent(data[0].name)
        }
      })
      .catch(() => {
        // Keep defaults
      })
  }, [])

  useEffect(() => {
    fetchTools()
      .then((data: ToolInfo[]) => setTools(data))
      .catch(() => {
        // Keep empty
      })
  }, [])

  // ── Fetch sessions on mount and after changes ──

  const refreshSessions = useCallback(() => {
    fetchSessions()
      .then((data) => setSessions(data))
      .catch(() => {
        // Sessions endpoint may not be available
      })
  }, [])

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  // ── Derived state ──

  const agentInfo =
    agents.find((a) => a.name === agent) ??
    agents[0] ??
    DEFAULT_AGENT

  const status: StreamStatus = chat.isStreaming
    ? "streaming"
    : chat.error
      ? "error"
      : "idle"

  // ── Handlers ──

  const handleSendMessage = useCallback(
    (text: string) => {
      chat.sendMessage(text, agent)
    },
    [chat.sendMessage, agent]
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
    },
    [chat.clear]
  )

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      document.documentElement.classList.toggle("dark", next === "dark")
      return next
    })
  }, [])

  const handleThemeChange = useCallback((t: string) => {
    setTheme(t)
    if (t === "dark" || t === "light") {
      document.documentElement.classList.toggle("dark", t === "dark")
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches
      document.documentElement.classList.toggle("dark", prefersDark)
    }
  }, [])

  const handleNewSession = useCallback(() => {
    chat.clear()
    setSelectedToolCallId(null)
    refreshSessions()
  }, [chat.clear, refreshSessions])

  const handleResumeSession = useCallback(
    async (sessionId: string) => {
      try {
        const sess = await fetchSession(sessionId)
        await chat.loadSession(sessionId, sess.messages as Array<{
          role: string
          content?: string
          reasoning_content?: string
          tool_calls?: Array<{ id: string; name: string; arguments: unknown }>
          tool_call_id?: string
          name?: string
        }>)
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
        // If we deleted the active session, clear it
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
        // Top bar
        agent={agentInfo}
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
          />
        }
        rightPanel={
          <InspectorPanel entry={selectedEntry} toolCall={selectedToolCall} />
        }
      />

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
      />
    </TooltipProvider>
  )
}

export default App
