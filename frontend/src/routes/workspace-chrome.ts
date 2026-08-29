import type { ReactNode } from "react"
import { useSyncExternalStore } from "react"
import type { AgentInfo, StreamStatus } from "@/types/agent"

export interface WorkspaceChrome {
  agent?: AgentInfo
  status?: StreamStatus
  agentLocked?: boolean
  onSelectAgent?: (id: string) => void
  onNewSession?: () => void
  activeSessionId?: string | null
  topBarActions?: ReactNode
}

const empty: WorkspaceChrome = {}
let chrome: WorkspaceChrome = empty
const listeners = new Set<() => void>()

export function setWorkspaceChrome(next: WorkspaceChrome) {
  const prev = chrome
  chrome = next
  if (
    prev.status === next.status &&
    prev.agent?.id === next.agent?.id &&
    prev.activeSessionId === next.activeSessionId &&
    prev.agentLocked === next.agentLocked
  ) {
    return
  }
  listeners.forEach((fn) => fn())
}

export function clearWorkspaceChrome() {
  setWorkspaceChrome(empty)
}

export function useWorkspaceChrome(): WorkspaceChrome {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => chrome
  )
}
