import { useMemo, useState } from "react"
import type { AgentInfo, ProviderInfo, StreamStatus } from "@/types/agent"
import type { useChat } from "@/hooks/use-chat"

export function useWorkspaceAgent(agents: AgentInfo[], pathname: string) {
  const [agent, setAgent] = useState(() => {
    const m = pathname.match(/^\/agents\/(.+)$/)
    return m ? decodeURIComponent(m[1]) : ""
  })
  const resolvedAgent = useMemo(() => {
    if (agents.length === 0) return agent
    const match = agents.find((a) => a.id === agent || a.name === agent)
    if (match) return match.id || match.name
    return agents[0].id || agents[0].name
  }, [agents, agent])
  const agentInfo =
    agents.find((a) => a.id === resolvedAgent || a.name === resolvedAgent) ??
    agents[0] ??
    null
  return { agent, setAgent, resolvedAgent, agentInfo }
}

export function useWorkspaceDerived(
  chat: ReturnType<typeof useChat>,
  agentInfo: AgentInfo | null,
  providers: ProviderInfo[],
  runModel: { provider: string; model: string }
) {
  const hasAgents = agentInfo !== null
  const agentLocked = chat.messages.length > 0
  const status: StreamStatus = chat.isStreaming
    ? "streaming"
    : chat.error
      ? "error"
      : "idle"
  const providerName = runModel.provider || agentInfo?.provider || ""
  const visionEnabled = providerName
    ? (providers.find((p) => p.name === providerName)?.vision ?? false)
    : false
  const listWindow = agentInfo?.context_window ?? agentInfo?.contextWindow ?? 0
  const tokenUsage = {
    inputTokens: chat.inputTokens,
    outputTokens: chat.outputTokens,
    contextWindow: chat.contextWindow > 0 ? chat.contextWindow : listWindow,
    cacheReadTokens: chat.cacheReadTokens,
    totalInputTokens: chat.totalInputTokens,
    totalOutputTokens: chat.totalOutputTokens,
  }
  return { hasAgents, agentLocked, status, visionEnabled, tokenUsage }
}
