import { useCallback } from "react"
import type { NavigateFunction } from "react-router"
import type { AgentInfo } from "@/types/agent"
import type { useChat } from "@/hooks/use-chat"
import { resolveApproval, updateSessionWorkdir } from "@/lib/api"

interface WorkspaceActionOpts {
  chat: ReturnType<typeof useChat>
  navigate: NavigateFunction
  agents: AgentInfo[]
  resolvedAgent: string
  agentInfo: AgentInfo | null
  workDir: string
  refreshSessions: () => void
  removeSession: (id: string) => void
  setAgent: (id: string) => void
  setSelectedToolCallId: (
    id: string | null | ((p: string | null) => string | null)
  ) => void
  setSessionWorkDir: (dir: string | null) => void
}

export function useWorkspaceSend(
  opts: Pick<
    WorkspaceActionOpts,
    "chat" | "agentInfo" | "resolvedAgent" | "workDir"
  >
) {
  return useCallback(
    (text: string, images?: { dataUrl: string; name: string }[]) =>
      opts.chat.sendMessage(
        text,
        opts.agentInfo?.id || opts.resolvedAgent || opts.agentInfo?.name || "",
        opts.workDir || undefined,
        images
      ),
    [opts]
  )
}

export function useWorkspaceSessionActions(opts: WorkspaceActionOpts) {
  const handleNewSession = useCallback(() => {
    opts.chat.clear()
    opts.setSelectedToolCallId(null)
    opts.setSessionWorkDir(null)
    opts.refreshSessions()
    const path = opts.resolvedAgent
      ? `/agents/${encodeURIComponent(opts.resolvedAgent)}`
      : "/"
    opts.navigate(path, { replace: true })
  }, [opts])
  const handleResumeSession = useCallback(
    async (id: string) => {
      const r = await opts.chat.resumeSession(id)
      if (!r) return
      const ref =
        opts.agents.find((a) => a.id === r.agent || a.name === r.agent)?.id ??
        r.agent
      opts.setAgent(ref)
      opts.setSessionWorkDir(r.workdir)
      opts.setSelectedToolCallId(null)
      const params = new URLSearchParams()
      params.set("session", id)
      opts.navigate(`/agents/${encodeURIComponent(ref)}?${params.toString()}`, {
        replace: true,
      })
    },
    [opts]
  )
  const handleWorkdirChange = useCallback(
    async (dir: string) => {
      opts.setSessionWorkDir(dir || null)
      if (opts.chat.sessionId) {
        try {
          await updateSessionWorkdir(opts.chat.sessionId, dir)
        } catch (e) {
          console.error(e)
        }
      }
    },
    [opts]
  )
  const handleDeleteSession = useCallback(
    (id: string) => {
      if (id === opts.chat.sessionId) opts.setSessionWorkDir(null)
      opts.removeSession(id)
    },
    [opts]
  )
  return {
    handleNewSession,
    handleResumeSession,
    handleWorkdirChange,
    handleDeleteSession,
  }
}

export function useWorkspaceMiscActions(
  opts: Pick<
    WorkspaceActionOpts,
    "chat" | "navigate" | "setAgent" | "setSelectedToolCallId"
  >
) {
  const handleSelectToolCall = useCallback(
    (id: string) => {
      opts.setSelectedToolCallId((p) => (p === id ? null : id))
    },
    [opts]
  )
  const handleSelectAgent = useCallback(
    (id: string) => {
      if (opts.chat.messages.length > 0) return
      opts.setAgent(id)
      opts.setSelectedToolCallId(null)
      opts.navigate(`/agents/${encodeURIComponent(id)}`, { replace: true })
    },
    [opts]
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
  return { handleSelectToolCall, handleSelectAgent, resolveToolApproval }
}
