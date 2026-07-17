import { useCallback, useEffect, useState } from "react"
import { fetchAgents } from "@/lib/api"
import { useAgentEvents } from "@/hooks/use-agent-events"
import type { AgentInfo } from "@/types/agent"

interface UseAgentManagerOptions {
  onAgentsChanged?: () => void
}

/** Manages agent list, file-change events, and agent CRUD UI state. */
export function useAgentManager({ onAgentsChanged }: UseAgentManagerOptions = {}) {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [agentDetailName, setAgentDetailName] = useState<string | null>(null)
  const [agentEditorName, setAgentEditorName] = useState<string | null>(null)
  const [agentEditorOpen, setAgentEditorOpen] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null)

  const refreshAgents = useCallback(() => {
    fetchAgents().then((raw) => { setAgents(raw ?? []); onAgentsChanged?.() }).catch(() => setAgents([]))
  }, [onAgentsChanged])

  useEffect(() => { refreshAgents() }, [refreshAgents])
  useAgentEvents({ onAgentChange: useCallback(() => refreshAgents(), [refreshAgents]) })

  const handleViewAgent = useCallback((id: string) => setAgentDetailName(id), [])
  const handleEditAgent = useCallback((id: string) => { setAgentEditorName(id); setAgentEditorOpen(true) }, [])
  const handleCreateAgent = useCallback(() => { setAgentEditorName(null); setAgentEditorOpen(true) }, [])
  const handleDeleteAgent = useCallback((id: string) => setAgentToDelete(id), [])
  const handleAgentSaved = useCallback(() => refreshAgents(), [refreshAgents])
  const handleAgentDeleted = useCallback(() => refreshAgents(), [refreshAgents])

  return {
    agents, agentDetailName, setAgentDetailName, agentEditorName,
    agentEditorOpen, setAgentEditorOpen, agentToDelete, setAgentToDelete,
    refreshAgents, handleViewAgent, handleEditAgent, handleCreateAgent,
    handleDeleteAgent, handleAgentSaved, handleAgentDeleted,
  }
}
