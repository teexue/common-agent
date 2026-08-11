import { ToolDetailDialog } from "@/components/tools/tool-detail-dialog"
import { AgentDetailDialog } from "@/components/agents/agent-detail-dialog"
import { AgentDeleteConfirm } from "@/components/agents/agent-delete-confirm"
import { SessionReplay } from "@/components/sessions/session-replay"
import { useAgentManager } from "@/hooks/use-agent-manager"
import type { ToolInfo } from "@/types/agent"

export function AppDialogs({
  agentMgr,
  selectedTool,
  setSelectedTool,
  replaySessionId,
  setReplaySessionId,
  onEditAgent,
}: {
  agentMgr: ReturnType<typeof useAgentManager>
  selectedTool: ToolInfo | null
  setSelectedTool: (t: ToolInfo | null) => void
  replaySessionId: string | null
  setReplaySessionId: (v: string | null) => void
  onEditAgent?: (id: string) => void
}) {
  return (
    <>
      <ToolDetailDialog
        tool={selectedTool}
        open={!!selectedTool}
        onOpenChange={(open) => {
          if (!open) setSelectedTool(null)
        }}
      />
      <AgentDetailDialog
        agentId={agentMgr.agentDetailName}
        open={!!agentMgr.agentDetailName}
        onOpenChange={(open) => {
          if (!open) agentMgr.setAgentDetailName(null)
        }}
        onEdit={(id) => {
          agentMgr.setAgentDetailName(null)
          onEditAgent?.(id)
        }}
        onDelete={(id) => {
          agentMgr.setAgentDetailName(null)
          agentMgr.handleDeleteAgent(id)
        }}
      />
      <AgentDeleteConfirm
        agentId={agentMgr.agentToDelete}
        open={!!agentMgr.agentToDelete}
        onOpenChange={(open) => {
          if (!open) agentMgr.setAgentToDelete(null)
        }}
        onDeleted={agentMgr.handleAgentDeleted}
      />
      <SessionReplay
        sessionId={replaySessionId}
        open={!!replaySessionId}
        onOpenChange={(open) => {
          if (!open) setReplaySessionId(null)
        }}
      />
    </>
  )
}
