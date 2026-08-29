import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@/components/shared/empty-state"
import { fetchMCPServers } from "@/lib/api"
import type { MCPServerInfo } from "@/types/agent"
import { FormError } from "./form-error"
import { AgentMcpSection, GlobalMcpSection } from "./mcp-panel-sections"
import { errMessage } from "./select-value"

/** MCP management panel for Settings: editable global servers + read-only per-agent. */
export function McpPanel() {
  const { t } = useTranslation()
  const [servers, setServers] = useState<MCPServerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(
    () =>
      fetchMCPServers()
        .then((list) => setServers(list ?? []))
        .catch((e: unknown) => {
          setServers([])
          setError(errMessage(e))
        }),
    []
  )
  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    void load().finally(() => setLoading(false))
  }, [load])
  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])
  if (loading) return <EmptyState title={t("settings.mcpLoading")} />
  return (
    <div className="space-y-4">
      <FormError error={error} />
      <GlobalMcpSection
        servers={servers.filter((s) => s.scope === "global")}
        editing={editing}
        setEditing={setEditing}
        refresh={refresh}
      />
      <AgentMcpSection servers={servers.filter((s) => s.scope === "agent")} />
    </div>
  )
}
