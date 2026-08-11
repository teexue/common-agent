import { Globe, Plug, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ListRow } from "@/components/shared/list-row"
import type { MCPServerInfo } from "@/types/agent"

export function GlobalMCPCard({
  server,
  onEdit,
  onDelete,
}: {
  server: MCPServerInfo
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <ListRow className="group flex items-center gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Globe className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{server.name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="secondary"
            className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
          >
            {server.type}
          </Badge>
          {server.command && (
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              {server.command}
            </span>
          )}
          {server.url && (
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              {server.url}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <Plug className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </ListRow>
  )
}

export function AgentMCPCard({ server }: { server: MCPServerInfo }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Plug className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{server.name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
          >
            {server.type}
          </Badge>
          {server.command && (
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              {server.command}
            </span>
          )}
          {server.url && (
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              {server.url}
            </span>
          )}
        </div>
      </div>
      <Badge
        variant="secondary"
        className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px]"
      >
        {server.agent}
      </Badge>
    </div>
  )
}
