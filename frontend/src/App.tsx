import { useCallback, useEffect, useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppLayout } from "@/components/layout/app-layout"
import { WorkspacePanel } from "@/components/conversation/workspace-panel"
import { InspectorPanel } from "@/components/inspector/inspector-panel"
import { ToolDetailDialog } from "@/components/tools/tool-detail-dialog"
import { SettingsSheet } from "@/components/settings/settings-sheet"
import { useChat } from "@/hooks/use-chat"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import type {
  ConversationEntry,
  ToolCallEntry,
  ToolInfo,
  ScenarioInfo,
  StreamStatus,
} from "@/types/agent"

// ─── Default / Fallback Data ──────────────────────────────────────

const DEFAULT_SCENARIO: ScenarioInfo = {
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
  const [scenario, setScenario] = useState("general-chat")
  const [selectedToolCallId, setSelectedToolCallId] = useState<string | null>(
    null
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [theme, setTheme] = useState<string>("dark")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null)

  // Data fetched from API
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([
    DEFAULT_SCENARIO,
  ])
  const [tools, setTools] = useState<ToolInfo[]>([])

  // ── Fetch scenarios & tools on mount ──

  useEffect(() => {
    fetch("/v1/scenarios")
      .then((r) => r.json())
      .then((data: string[]) => {
        if (data.length > 0) {
          setScenarios(data.map((name) => ({ ...DEFAULT_SCENARIO, name })))
          setScenario(data[0])
        }
      })
      .catch(() => {
        // Keep defaults
      })
  }, [])

  useEffect(() => {
    fetch("/v1/tools")
      .then((r) => r.json())
      .then((data: ToolInfo[]) => setTools(data))
      .catch(() => {
        // Keep empty
      })
  }, [])

  // ── Derived state ──

  const scenarioInfo =
    scenarios.find((s) => s.name === scenario) ??
    scenarios[0] ??
    DEFAULT_SCENARIO

  const status: StreamStatus = chat.isStreaming
    ? "streaming"
    : chat.error
      ? "error"
      : "idle"

  // ── Handlers ──

  const handleSendMessage = useCallback(
    (text: string) => {
      chat.sendMessage(text, scenario)
    },
    [chat.sendMessage, scenario]
  )

  const handleSelectToolCall = useCallback(
    (id: string) => {
      setSelectedToolCallId((prev) => (prev === id ? null : id))
      if (!inspectorOpen) setInspectorOpen(true)
    },
    [inspectorOpen]
  )

  const handleSelectScenario = useCallback(
    (name: string) => {
      setScenario(name)
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
        scenarios={scenarios}
        selectedScenario={scenario}
        onSelectScenario={handleSelectScenario}
        tools={tools}
        onSelectTool={setSelectedTool}
        onOpenSettings={() => setSettingsOpen(true)}
        onNewSession={() => {
          chat.clear()
          setSelectedToolCallId(null)
        }}
        // Top bar
        scenario={scenarioInfo}
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
            selectedToolCallId={selectedToolCallId}
            onSelectToolCall={handleSelectToolCall}
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
