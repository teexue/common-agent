import { ToolDetailDialog } from "@/components/tools/tool-detail-dialog"
import { AgentDeleteConfirm } from "@/components/agents/agent-delete-confirm"
import { useAgentManager } from "@/hooks/use-agent-manager"
import type { ToolInfo } from "@/types/agent"

export function AppDialogs({
  agentMgr,
  selectedTool,
  setSelectedTool,
}: {
  agentMgr: ReturnType<typeof useAgentManager>
  selectedTool: ToolInfo | null
  setSelectedTool: (t: ToolInfo | null) => void
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
      <AgentDeleteConfirm
        agentId={agentMgr.agentToDelete}
        open={!!agentMgr.agentToDelete}
        onOpenChange={(open) => {
          if (!open) agentMgr.setAgentToDelete(null)
        }}
        onDeleted={agentMgr.handleAgentDeleted}
      />
    </>
  )
}
