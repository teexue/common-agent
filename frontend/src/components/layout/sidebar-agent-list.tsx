import { Info, Layers, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AgentInfo } from "@/types/agent"

interface AgentListProps {
  agents: AgentInfo[]
  selectedAgent: string
  onSelectAgent: (name: string) => void
  onViewAgent?: (name: string) => void
  onEditAgent?: (name: string) => void
  onDeleteAgent?: (name: string) => void
  onCreateAgent?: () => void
}

function AgentContextMenu({
  agentName, onViewAgent, onEditAgent, onDeleteAgent,
}: {
  agentName: string
  onViewAgent?: (name: string) => void
  onEditAgent?: (name: string) => void
  onDeleteAgent?: (name: string) => void
}) {
  if (!onViewAgent && !onEditAgent && !onDeleteAgent) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="mr-1 h-5 w-5 shrink-0 rounded-md opacity-0 transition-opacity group-hover:opacity-100" />}>
        <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 rounded-xl">
        {onViewAgent && (
          <DropdownMenuItem onClick={() => onViewAgent(agentName)} className="gap-2 text-xs">
            <Info className="h-3.5 w-3.5" /> 查看详情
          </DropdownMenuItem>
        )}
        {onEditAgent && (
          <DropdownMenuItem onClick={() => onEditAgent(agentName)} className="gap-2 text-xs">
            <Pencil className="h-3.5 w-3.5" /> 编辑
          </DropdownMenuItem>
        )}
        {onDeleteAgent && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDeleteAgent(agentName)} className="gap-2 text-xs text-destructive focus:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> 删除
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AgentListItem({
  agent, selected, onSelect, onViewAgent, onEditAgent, onDeleteAgent,
}: {
  agent: AgentInfo
  selected: boolean
  onSelect: () => void
  onViewAgent?: (name: string) => void
  onEditAgent?: (name: string) => void
  onDeleteAgent?: (name: string) => void
}) {
  return (
    <div className={`group flex items-center gap-1 rounded-xl transition-all ${selected ? "bg-primary/8" : "hover:bg-sidebar-accent"}`}>
      <button
        onClick={onSelect}
        className={`flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left ${selected ? "text-primary" : "text-sidebar-foreground"}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full transition-colors ${selected ? "bg-primary" : "bg-muted-foreground/25 group-hover:bg-primary/40"}`} />
        <span className="flex-1 truncate text-xs font-medium">{agent.name}</span>
        <Badge variant="outline" className={`shrink-0 border-0 text-[9px] ${selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {(agent.tools ?? []).length}
        </Badge>
      </button>
      <AgentContextMenu agentName={agent.name} {...{ onViewAgent, onEditAgent, onDeleteAgent }} />
    </div>
  )
}

export function AgentList({
  agents, selectedAgent, onSelectAgent, onViewAgent, onEditAgent, onDeleteAgent, onCreateAgent,
}: AgentListProps) {
  return (
    <div className="p-2.5">
      <div className="mb-2 flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          <Layers className="h-3 w-3" /> Agent
        </div>
        {onCreateAgent && (
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={onCreateAgent} className="h-5 w-5 rounded-md" />}>
              <Plus className="h-3 w-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>创建新 Agent</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {agents.map((a) => (
          <AgentListItem key={a.name} agent={a} selected={selectedAgent === a.name} onSelect={() => onSelectAgent(a.name)} {...{ onViewAgent, onEditAgent, onDeleteAgent }} />
        ))}
      </div>
    </div>
  )
}
