import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ChevronDown, Lock } from "lucide-react"
import type { AgentInfo } from "@/types/agent"

function AgentIdentity({ agent }: { agent: AgentInfo }) {
  return (
    <>
      <span className="text-sm font-medium tracking-tight text-foreground">
        {agent.name}
      </span>
    </>
  )
}

function StaticAgent({ agent }: { agent: AgentInfo }) {
  return (
    <div className="flex items-center gap-2">
      <AgentIdentity agent={agent} />
    </div>
  )
}

function LockedAgent({ agent }: { agent: AgentInfo }) {
  const { t } = useTranslation()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left"
          />
        }
      >
        <AgentIdentity agent={agent} />
        <Lock className="h-3 w-3 text-muted-foreground/60" />
      </TooltipTrigger>
      <TooltipContent>{t("layout.agentLockedHint")}</TooltipContent>
    </Tooltip>
  )
}

function AgentMenu({
  agent,
  agents,
  onSelect,
}: {
  agent: AgentInfo
  agents: AgentInfo[]
  onSelect: (id: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-foreground hover:bg-muted"
          />
        }
      >
        <AgentIdentity agent={agent} />
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl">
        {agents.map((a) => (
          <DropdownMenuItem
            key={a.id || a.name}
            onClick={() => onSelect(a.id || a.name)}
            className={`gap-2 text-xs ${(a.id || a.name) === (agent.id || agent.name) ? "bg-primary/8 text-primary" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate font-medium">{a.name}</span>
              {a.model && (
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  {a.model}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AgentSwitcher({
  agent,
  agents,
  locked,
  onSelectAgent,
}: {
  agent: AgentInfo
  agents: AgentInfo[]
  locked: boolean
  onSelectAgent?: (id: string) => void
}) {
  if (!onSelectAgent || agents.length === 0) {
    return <StaticAgent agent={agent} />
  }
  if (locked) return <LockedAgent agent={agent} />
  return <AgentMenu agent={agent} agents={agents} onSelect={onSelectAgent} />
}
