import { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"
import { AppLayout } from "@/components/layout/app-layout"
import { WorkspacePanel } from "@/components/conversation/workspace-panel"
import { ConversationActions } from "@/components/conversation/conversation-actions"
import { SessionWorkdir } from "@/components/conversation/session-workdir"
import { useChat } from "@/hooks/use-chat"
import { useAgentManager } from "@/hooks/use-agent-manager"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useMessageSearch } from "@/hooks/use-message-search"
import {
  deleteSession,
  resolveApproval,
  fetchProviders,
  updateSessionWorkdir,
} from "@/lib/api"
import type {
  StreamStatus,
  ProviderInfo,
} from "@/types/agent"
import { AppDialogs } from "./app-dialogs"
import { useSessionList } from "./shell-hooks"

function useSessions(chat: ReturnType<typeof useChat>) {
  const list = useSessionList()
  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteSession(id)
        if (chat.sessionId === id) chat.clear()
        list.refresh()
      } catch (err) {
        console.error("Failed to delete session:", err)
      }
    },
    [chat, list.refresh]
  )
  return { sessions: list.sessions, refresh: list.refresh, remove }
}

export function WorkspaceRoute() {
  const chat = useChat()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const sessMgr = useSessions(chat)
  const search = useMessageSearch(chat.messages)

  const [agent, setAgent] = useState(() => {
    const m = location.pathname.match(/^\/agents\/(.+)$/)
    return m ? decodeURIComponent(m[1]) : ""
  })
  const [selectedToolCallId, setSelectedToolCallId] = useState<string | null>(
    null
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [replaySessionId, setReplaySessionId] = useState<string | null>(null)
  const [sessionWorkDir, setSessionWorkDir] = useState<string | null>(null)
  const globalWorkDir = localStorage.getItem("workDir") || ""
  // Per-session choice wins; otherwise fall back to the global setting.
  const workDir = sessionWorkDir ?? globalWorkDir
  const [providers, setProviders] = useState<ProviderInfo[]>([])

  const agentMgr = useAgentManager()
  const { agents } = agentMgr

  useEffect(() => {
    fetchProviders()
      .then((d) => setProviders(d ?? []))
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (chat.sessionId) sessMgr.refresh()
  }, [chat.sessionId, sessMgr.refresh])
  // Mirror the active session id into the URL (?session=) so a page refresh
  // can recover the conversation — including an in-progress run.
  useEffect(() => {
    if (!chat.sessionId) return
    const params = new URLSearchParams(location.search)
    if (params.get("session") === chat.sessionId) return
    params.set("session", chat.sessionId)
    params.delete("resume")
    navigate(`${location.pathname}?${params.toString()}`, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.sessionId])
  useEffect(() => {
    if (agents.length === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgent((prev) => {
      if (prev && agents.some((a) => a.id === prev || a.name === prev)) {
        const match = agents.find((a) => a.id === prev || a.name === prev)
        return match?.id || prev
      }
      return agents[0].id || agents[0].name
    })
  }, [agents])

  // Resume a session from the URL (?session=, legacy ?resume=). Handles both
  // finished sessions and in-progress runs (via replay polling).
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const id = params.get("session") || params.get("resume")
    if (!id) return
    if (chat.sessionId === id) {
      // Already loaded; just normalize a legacy ?resume= to ?session=.
      if (params.get("resume")) {
        params.set("session", id)
        params.delete("resume")
        navigate(`${location.pathname}?${params.toString()}`, { replace: true })
      }
      return
    }
    let cancelled = false
    ;(async () => {
      const r = await chat.resumeSession(id)
      if (cancelled || !r) return
      setAgent(r.agent)
      setSessionWorkDir(r.workdir)
      setSelectedToolCallId(null)
      params.set("session", id)
      params.delete("resume")
      navigate(`${location.pathname}?${params.toString()}`, { replace: true })
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  const agentInfo =
    agents.find((a) => a.id === agent || a.name === agent) ?? agents[0] ?? null
  const hasAgents = agents.length > 0 && agentInfo !== null
  const agentLocked = chat.messages.length > 0
  const status: StreamStatus = chat.isStreaming
    ? "streaming"
    : chat.error
      ? "error"
      : "idle"
  const visionEnabled = agentInfo
    ? (providers.find((p) => p.name === agentInfo.provider)?.vision ?? false)
    : false

  const handleSendMessage = useCallback(
    (text: string, images?: { dataUrl: string; name: string }[]) =>
      chat.sendMessage(
        text,
        agentInfo?.id || agent || agentInfo?.name || "",
        workDir || undefined,
        images
      ),
    [chat.sendMessage, agent, agentInfo, workDir]
  )
  const handleSelectToolCall = useCallback(
    (id: string) => {
      setSelectedToolCallId((p) => (p === id ? null : id))
    },
    []
  )
  const handleSelectAgent = useCallback(
    (id: string) => {
      if (chat.messages.length > 0) return
      setAgent(id)
      setSelectedToolCallId(null)
      navigate(`/agents/${encodeURIComponent(id)}`, { replace: true })
    },
    [chat.messages.length, navigate]
  )
  const handleToggleTheme = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme, setTheme]
  )
  const handleNewSession = useCallback(() => {
    chat.clear()
    setSelectedToolCallId(null)
    setSessionWorkDir(null)
    sessMgr.refresh()
  }, [chat.clear, sessMgr.refresh])
  const handleResumeSession = useCallback(
    async (id: string) => {
      const r = await chat.resumeSession(id)
      if (!r) return
      setAgent(r.agent)
      setSessionWorkDir(r.workdir)
      setSelectedToolCallId(null)
      const params = new URLSearchParams()
      params.set("session", id)
      navigate(
        `/agents/${encodeURIComponent(r.agent)}?${params.toString()}`,
        { replace: true }
      )
    },
    [chat.resumeSession, navigate]
  )
  const handleWorkdirChange = useCallback(
    async (dir: string) => {
      setSessionWorkDir(dir || null)
      if (chat.sessionId) {
        try {
          await updateSessionWorkdir(chat.sessionId, dir)
        } catch (e) {
          console.error(e)
        }
      }
    },
    [chat.sessionId]
  )
  const handleDeleteSession = useCallback(
    (id: string) => {
      if (id === chat.sessionId) setSessionWorkDir(null)
      sessMgr.remove(id)
    },
    [chat.sessionId, sessMgr.remove]
  )
  const resolveToolApproval = useCallback(
    async (id: string, approve: boolean) => {
      try {
        await resolveApproval(id, approve)
      } catch (e) {
        console.error(e)
      }
    },
    []
  )
  const handleReplaySession = useCallback(
    (id: string) => setReplaySessionId(id),
    []
  )

  useKeyboardShortcuts({
    onToggleSidebar: () => setSidebarCollapsed((v) => !v),
    onClosePanel: () => setSelectedToolCallId(null),
  })

  // Prefer the window from the last done event (Ollama /api/show, model spec,
  // or an explicit agent setting). The agent list only knows specs/config, so
  // it is a fallback for the first message before any run has completed.
  const listWindow =
    agentInfo?.context_window ?? agentInfo?.contextWindow ?? 0
  const tokenUsage = {
    inputTokens: chat.inputTokens,
    outputTokens: chat.outputTokens,
    contextWindow: chat.contextWindow > 0 ? chat.contextWindow : listWindow,
    cacheReadTokens: chat.cacheReadTokens,
  }

  return (
    <TooltipProvider delay={300}>
      <AppLayout
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        onOpenSettings={() => navigate("/settings")}
        onOpenManage={() => navigate("/manage")}
        onOpenKanban={() => navigate("/kanban")}
        onOpenApiDocs={() => navigate("/api-docs")}
        onOpenAdmin={() => navigate("/admin")}
        onNewSession={handleNewSession}
        sessions={sessMgr.sessions}
        activeSessionId={chat.sessionId}
        onResumeSession={handleResumeSession}
        onDeleteSession={handleDeleteSession}
        onReplaySession={handleReplaySession}
        agent={
          agentInfo ?? {
            id: "",
            name: "common-agent",
            provider: "",
            model: "",
            tools: [],
            maxTurns: 10,
          }
        }
        agents={agents}
        agentLocked={agentLocked}
        onSelectAgent={handleSelectAgent}
        status={status}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        topBarActions={
          <ConversationActions
            searchOpen={search.searchOpen}
            onToggleSearch={search.toggleOpen}
            messages={chat.messages}
            agentName={agentInfo?.name || agent}
          />
        }
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
            search={search}
            inputAccessory={
              <SessionWorkdir
                workDir={workDir}
                sessionScoped={sessionWorkDir !== null}
                onPick={(dir) => void handleWorkdirChange(dir)}
                onClear={() => void handleWorkdirChange("")}
              />
            }
            tokenUsage={tokenUsage}
          />
        }
      />
      <AppDialogs
        agentMgr={agentMgr}
        selectedTool={null}
        setSelectedTool={() => {}}
        replaySessionId={replaySessionId}
        setReplaySessionId={setReplaySessionId}
        onEditAgent={(id) =>
          navigate(`/manage/agents/${encodeURIComponent(id)}/edit`)
        }
      />
    </TooltipProvider>
  )
}
