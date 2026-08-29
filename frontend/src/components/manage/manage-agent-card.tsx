import { useTranslation } from "react-i18next"
import { Bot, Copy, Info, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ListRow } from "@/components/shared/list-row"
import type { AgentInfo } from "@/types/agent"

export function AgentCard({
  agent,
  onView,
  onEdit,
  onCopy,
  onDelete,
}: {
  agent: AgentInfo
  onView?: (id: string) => void
  onEdit?: (id: string) => void
  onCopy?: (id: string) => void
  onDelete?: (id: string) => void
}) {
  const agentKey = agent.id || agent.name
  return (
    <ListRow className="group flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{agent.name}</p>
        <AgentCardBadges agent={agent} />
      </div>
      <AgentCardMenu
        agentKey={agentKey}
        onView={onView}
        onEdit={onEdit}
        onCopy={onCopy}
        onDelete={onDelete}
      />
    </ListRow>
  )
}

function AgentCardBadges({ agent }: { agent: AgentInfo }) {
  const { t } = useTranslation()
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {agent.id && (
        <Badge
          variant="outline"
          className="rounded-md px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
        >
          {agent.id}
        </Badge>
      )}
      <Badge
        variant="secondary"
        className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
      >
        {agent.provider}
      </Badge>
      {agent.model && (
        <Badge
          variant="outline"
          className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
        >
          {agent.model}
        </Badge>
      )}
      <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px]">
        {t("manage.toolsCount", { count: (agent.tools ?? []).length })}
      </Badge>
    </div>
  )
}

function AgentCardMenu({
  agentKey,
  onView,
  onEdit,
  onCopy,
  onDelete,
}: {
  agentKey: string
  onView?: (id: string) => void
  onEdit?: (id: string) => void
  onCopy?: (id: string) => void
  onDelete?: (id: string) => void
}) {
  if (!onView && !onEdit && !onCopy && !onDelete) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7 rounded-lg opacity-0 transition-opacity group-hover:opacity-100"
          />
        }
      >
        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 rounded-xl">
        <AgentCardMenuItems
          agentKey={agentKey}
          onView={onView}
          onEdit={onEdit}
          onCopy={onCopy}
          onDelete={onDelete}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AgentCardMenuItems({
  agentKey,
  onView,
  onEdit,
  onCopy,
  onDelete,
}: {
  agentKey: string
  onView?: (id: string) => void
  onEdit?: (id: string) => void
  onCopy?: (id: string) => void
  onDelete?: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {onView && (
        <DropdownMenuItem
          onClick={() => onView(agentKey)}
          className="gap-2 text-xs"
        >
          <Info className="h-3.5 w-3.5" /> {t("layout.viewDetails")}
        </DropdownMenuItem>
      )}
      {onEdit && (
        <DropdownMenuItem
          onClick={() => onEdit(agentKey)}
          className="gap-2 text-xs"
        >
          <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
        </DropdownMenuItem>
      )}
      {onCopy && (
        <DropdownMenuItem
          onClick={() => onCopy(agentKey)}
          className="gap-2 text-xs"
        >
          <Copy className="h-3.5 w-3.5" /> {t("common.copy")}
        </DropdownMenuItem>
      )}
      {onDelete && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(agentKey)}
            className="gap-2 text-xs text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
          </DropdownMenuItem>
        </>
      )}
    </>
  )
}
