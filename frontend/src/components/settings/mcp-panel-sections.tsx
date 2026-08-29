import { useTranslation } from "react-i18next"
import { Globe, Plug, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { GlobalMCPForm } from "./mcp-form"
import { AgentMCPCard, GlobalMCPCard } from "./mcp-server-cards"
import { serverToForm } from "./mcp-form-state"
import { deleteGlobalMCP } from "@/lib/api"
import type { MCPServerInfo } from "@/types/agent"

function SectionLabel({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">
        {count}
      </Badge>
    </div>
  )
}

function GlobalMcpItem({
  server,
  editing,
  onEdit,
  onCancel,
  onSaved,
  onDelete,
}: {
  server: MCPServerInfo
  editing: string | null
  onEdit: () => void
  onCancel: () => void
  onSaved: () => void
  onDelete: () => Promise<void>
}) {
  if (editing === server.name) {
    return (
      <GlobalMCPForm
        initial={serverToForm(server)}
        onSaved={onSaved}
        onCancel={onCancel}
      />
    )
  }
  return (
    <GlobalMCPCard
      server={server}
      onEdit={onEdit}
      onDelete={() => void onDelete()}
    />
  )
}

function GlobalMcpHeader({
  count,
  canAdd,
  onAdd,
}: {
  count: number
  canAdd: boolean
  onAdd: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between">
      <SectionLabel
        icon={<Globe className="h-3.5 w-3.5 text-muted-foreground" />}
        label={t("settings.mcpGlobal")}
        count={count}
      />
      {canAdd && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" /> {t("agent.mcpAdd")}
        </Button>
      )}
    </div>
  )
}

export function GlobalMcpSection({
  servers,
  editing,
  setEditing,
  refresh,
}: {
  servers: MCPServerInfo[]
  editing: string | null
  setEditing: (v: string | null) => void
  refresh: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <GlobalMcpHeader
        count={servers.length}
        canAdd={editing === null}
        onAdd={() => setEditing("")}
      />
      {servers.length === 0 && editing === null && (
        <EmptyState title={t("settings.mcpGlobalEmpty")} />
      )}
      {servers.map((s) => (
        <GlobalMcpItem
          key={s.name}
          server={s}
          editing={editing}
          onEdit={() => setEditing(s.name)}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
          onDelete={async () => {
            await deleteGlobalMCP(s.name)
            refresh()
          }}
        />
      ))}
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
  )
}

export function AgentMcpSection({ servers }: { servers: MCPServerInfo[] }) {
  const { t } = useTranslation()
  if (servers.length === 0) return null
  return (
    <div className="space-y-2">
      <SectionLabel
        icon={<Plug className="h-3.5 w-3.5 text-muted-foreground" />}
        label={t("settings.mcpPerAgent")}
        count={servers.length}
      />
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {t("settings.mcpPerAgentHint")}
      </p>
      {servers.map((s) => (
        <AgentMCPCard key={`${s.agent}-${s.name}`} server={s} />
      ))}
    </div>
  )
}
