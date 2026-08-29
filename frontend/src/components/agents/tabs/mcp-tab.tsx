import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  emptyMcpServer,
  type AgentFormData,
  type McpServerFormItem,
} from "@/lib/agent-yaml"
import { SectionCard } from "./shared"
import { McpServerRow } from "./mcp-server-row"

export function McpTab({
  form,
  setForm,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <SectionCard
        title={t("agent.sectionMcp")}
        description={t("agent.sectionMcpDesc")}
      >
        <McpServerList form={form} setForm={setForm} />
      </SectionCard>
    </div>
  )
}

function McpServerList({
  form,
  setForm,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
}) {
  const { t } = useTranslation()
  const servers = form.mcpServers
  return (
    <>
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="rounded-md px-2 py-1 text-[10px]">
          {t("agent.mcpCount", { count: servers.length })}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() =>
            setForm((f) => ({
              ...f,
              mcpServers: [...f.mcpServers, emptyMcpServer()],
            }))
          }
        >
          <Plus className="h-3.5 w-3.5" /> {t("agent.mcpAdd")}
        </Button>
      </div>
      {servers.length === 0 ? (
        <EmptyState title={t("agent.mcpEmpty")} />
      ) : (
        <div className="space-y-3">
          {servers.map((srv, idx) => (
            <McpServerRow
              key={idx}
              server={srv}
              onChange={(patch) => patchServer(setForm, idx, patch)}
              onRemove={() => removeServer(setForm, idx)}
            />
          ))}
        </div>
      )}
    </>
  )
}

function patchServer(
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>,
  idx: number,
  patch: Partial<McpServerFormItem>
) {
  setForm((f) => ({
    ...f,
    mcpServers: f.mcpServers.map((s, i) =>
      i === idx ? { ...s, ...patch } : s
    ),
  }))
}

function removeServer(
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>,
  idx: number
) {
  setForm((f) => ({
    ...f,
    mcpServers: f.mcpServers.filter((_, i) => i !== idx),
  }))
}
