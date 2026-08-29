import { useNavigate, useParams, useSearchParams } from "react-router"
import { AgentEditorPage } from "@/components/agents/agent-editor"

export function AgentEditorRoute({ mode }: { mode: "create" | "edit" }) {
  const navigate = useNavigate()
  const { agentId } = useParams<{ agentId: string }>()
  const [searchParams] = useSearchParams()
  const id = mode === "edit" ? decodeURIComponent(agentId || "") : null
  const copyFrom = mode === "create" ? (searchParams.get("copy") ?? null) : null
  return (
    <AgentEditorPage
      key={`${mode}:${id ?? ""}:${copyFrom ?? ""}`}
      agentId={id}
      copyFrom={copyFrom}
      onBack={() => navigate("/manage")}
      onSaved={() => navigate("/manage")}
    />
  )
}
