import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Globe, Plug, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlobalMCPForm } from "@/components/settings/mcp-form"
import {
  AgentMCPCard,
  GlobalMCPCard,
} from "@/components/settings/mcp-server-cards"
import { EmptyState } from "@/components/shared/empty-state"
import { deleteGlobalMCP, fetchMCPServers } from "@/lib/api"
import type { MCPServerInfo } from "@/types/agent"

/** MCP management panel for Settings: editable global servers + read-only per-agent. */
export function McpPanel() {
  const { t } = useTranslation()
  const [servers, setServers] = useState<MCPServerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    setError(null)
    fetchMCPServers()
      .then((list) => setServers(list ?? []))
      .catch((e: unknown) => {
        setServers([])
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    refresh()
  }, [])

  if (loading) return <EmptyState title={t("settings.mcpLoading")} />

  const globalServers = servers.filter((s) => s.scope === "global")
  const agentServers = servers.filter((s) => s.scope === "agent")

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t("settings.mcpGlobal")}
            </span>
            <Badge
              variant="secondary"
              className="rounded-md px-1.5 py-0 text-[10px]"
            >
              {globalServers.length}
            </Badge>
          </div>
          {editing === null && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setEditing("")}
            >
              <Plus className="h-3.5 w-3.5" /> {t("agent.mcpAdd")}
            </Button>
          )}
        </div>

        {globalServers.length === 0 && editing === null && (
          <EmptyState title={t("settings.mcpGlobalEmpty")} />
        )}

        {globalServers.map((s) =>
          editing === s.name ? (
            <GlobalMCPForm
              key={s.name}
              initial={{
                name: s.name,
                type: s.type === "sse" ? "sse" : "stdio",
                command: s.command ?? "",
                args: "",
                env: "",
                url: s.url ?? "",
              }}
              onSaved={() => {
                setEditing(null)
                refresh()
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <GlobalMCPCard
              key={s.name}
              server={s}
              onEdit={() => setEditing(s.name)}
              onDelete={async () => {
                await deleteGlobalMCP(s.name)
                refresh()
              }}
            />
          )
        )}
        {editing === "" && (
          <GlobalMCPForm
            onSaved={() => {
              setEditing(null)
              refresh()
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </div>

      {agentServers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Plug className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t("settings.mcpPerAgent")}
            </span>
            <Badge
              variant="secondary"
              className="rounded-md px-1.5 py-0 text-[10px]"
            >
              {agentServers.length}
            </Badge>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {t("settings.mcpPerAgentHint")}
          </p>
          {agentServers.map((s) => (
            <AgentMCPCard key={`${s.agent}-${s.name}`} server={s} />
          ))}
        </div>
      )}
    </div>
  )
}
