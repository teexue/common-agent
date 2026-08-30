import { useNavigate, useParams, useSearchParams } from "react-router"
import { AgentDetailPage } from "@/components/agents/agent-detail-page"
import { AgentDeleteConfirm } from "@/components/agents/agent-delete-confirm"
import { useShell } from "./shell-context"

export function AgentDetailRoute() {
  const navigate = useNavigate()
  const shell = useShell()
  const { agentId } = useParams<{ agentId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const id = decodeURIComponent(agentId || "")
  const deleteTarget = searchParams.get("delete")
  return (
    <>
      <AgentDetailPage
        agentId={id}
        onEdit={(agentKey) =>
          navigate(`/manage/agents/${encodeURIComponent(agentKey)}/edit`)
        }
        onCopy={(agentKey) =>
          navigate(`/manage/agents/new?copy=${encodeURIComponent(agentKey)}`)
        }
        onDelete={(agentKey) => setSearchParams({ delete: agentKey })}
      />
      <AgentDeleteConfirm
        agentId={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setSearchParams({})
        }}
        onDeleted={() => {
          shell.agentMgr.handleAgentDeleted()
          navigate("/manage")
        }}
      />
    </>
  )
}
