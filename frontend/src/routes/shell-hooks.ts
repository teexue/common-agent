import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { fetchSessions, fetchSession, deleteSession } from "@/lib/api"
import type { SessionMeta } from "@/types/agent"

export function useSessionList() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const refresh = useCallback(() => {
    fetchSessions()
      .then((d) => setSessions(d ?? []))
      .catch(() => {})
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])
  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteSession(id)
        refresh()
      } catch (err) {
        console.error("Failed to delete session:", err)
      }
    },
    [refresh]
  )
  return { sessions, refresh, remove }
}

export function useShellNav() {
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const sessList = useSessionList()
  const [replaySessionId, setReplaySessionId] = useState<string | null>(null)

  useKeyboardShortcuts({
    onToggleSidebar: () => setSidebarCollapsed((v) => !v),
    onClosePanel: () => {},
  })

  const handleResumeSession = useCallback(
    async (id: string) => {
      try {
        const sess = await fetchSession(id)
        navigate(
          `/agents/${encodeURIComponent(sess.agent)}?resume=${encodeURIComponent(id)}`
        )
      } catch (err) {
        console.error("Failed to resume session:", err)
      }
    },
    [navigate]
  )

  return {
    navigate,
    sidebarCollapsed,
    setSidebarCollapsed,
    onToggleSidebar: () => setSidebarCollapsed((v) => !v),
    onOpenSettings: () => navigate("/settings"),
    onOpenManage: () => navigate("/manage"),
    onOpenKanban: () => navigate("/kanban"),
    onOpenRequestLogs: () => navigate("/request-logs"),
    onOpenApiDocs: () => navigate("/api-docs"),
    onNewSession: () => navigate("/"),
    sessions: sessList.sessions,
    onResumeSession: handleResumeSession,
    onDeleteSession: sessList.remove,
    onReplaySession: (id: string) => setReplaySessionId(id),
    replaySessionId,
    setReplaySessionId,
  }
}

export function shellLayoutProps(
  shell: ReturnType<typeof useShellNav>,
  theme: string,
  setTheme: (t: "dark" | "light" | "system") => void
) {
  return {
    sidebarCollapsed: shell.sidebarCollapsed,
    onToggleSidebar: shell.onToggleSidebar,
    onOpenSettings: shell.onOpenSettings,
    onOpenManage: shell.onOpenManage,
    onOpenKanban: shell.onOpenKanban,
    onOpenRequestLogs: shell.onOpenRequestLogs,
    onOpenApiDocs: shell.onOpenApiDocs,
    onNewSession: shell.onNewSession,
    sessions: shell.sessions,
    onResumeSession: shell.onResumeSession,
    onDeleteSession: shell.onDeleteSession,
    onReplaySession: shell.onReplaySession,
    agent: {
      id: "",
      name: "common-agent",
      provider: "",
      model: "",
      tools: [] as string[],
      maxTurns: 10,
    },
    status: "idle" as const,
    inspectorOpen: false,
    onToggleInspector: () => {},
    theme,
    onToggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    showInspector: false as const,
  }
}
