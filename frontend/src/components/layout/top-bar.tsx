import { useTranslation } from "react-i18next"
import { ChevronDown, Lock, Moon, PanelRightClose, PanelRightOpen, Sun } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { StatusIndicator } from "@/components/shared/status-indicator"
import { HealthIndicator } from "@/components/monitoring/health-indicator"
import type { AgentInfo, StreamStatus } from "@/types/agent"

interface TopBarProps {
  agent: AgentInfo
  agents?: AgentInfo[]
  agentLocked?: boolean
  onSelectAgent?: (id: string) => void
  status: StreamStatus
  artifactOpen: boolean
  onToggleArtifact: () => void
  theme: string
  onToggleTheme: () => void
}

function TopBarButton({ tooltip, onClick, children }: { tooltip: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={onClick} className="h-7 w-7 rounded-lg" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function AgentSwitcher({
  agent, agents, locked, onSelectAgent,
}: {
  agent: AgentInfo
  agents: AgentInfo[]
  locked: boolean
  onSelectAgent?: (id: string) => void
}) {
  const { t } = useTranslation()

  if (!onSelectAgent || agents.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-heading text-sm tracking-tight text-foreground">{agent.name}</span>
        {agent.model && (
          <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px] font-mono">{agent.model}</Badge>
        )}
      </div>
    )
  }

  if (locked) {
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
          <span className="font-heading text-sm tracking-tight text-foreground">{agent.name}</span>
          {agent.model && (
            <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px] font-mono">{agent.model}</Badge>
          )}
          <Lock className="h-3 w-3 text-muted-foreground/60" />
        </TooltipTrigger>
        <TooltipContent>{t("layout.agentLockedHint")}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-lg px-2 text-foreground hover:bg-muted"
          />
        }
      >
        <span className="font-heading text-sm tracking-tight">{agent.name}</span>
        {agent.model && (
          <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px] font-mono">{agent.model}</Badge>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl">
        {agents.map((a) => (
          <DropdownMenuItem
            key={a.id || a.name}
            onClick={() => onSelectAgent(a.id || a.name)}
            className={`gap-2 text-xs ${(a.id || a.name) === (agent.id || agent.name) ? "bg-primary/8 text-primary" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate font-medium">{a.name}</span>
              {a.model && (
                <span className="block truncate font-mono text-[10px] text-muted-foreground">{a.model}</span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TopBar({
  agent, agents = [], agentLocked = false, onSelectAgent,
  status, artifactOpen, onToggleArtifact, theme, onToggleTheme,
}: TopBarProps) {
  const { t } = useTranslation()
  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <AgentSwitcher agent={agent} agents={agents} locked={agentLocked} onSelectAgent={onSelectAgent} />
        <StatusIndicator status={status} />
      </div>

      <div className="flex items-center gap-0.5">
        <HealthIndicator />
        <TopBarButton tooltip={t("layout.toggleTheme")} onClick={onToggleTheme}>
          {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-muted-foreground" /> : <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
        </TopBarButton>
        <TopBarButton tooltip={artifactOpen ? t("layout.closeInspector") : t("layout.openInspector")} onClick={onToggleArtifact}>
          {artifactOpen ? <PanelRightClose className="h-3.5 w-3.5 text-muted-foreground" /> : <PanelRightOpen className="h-3.5 w-3.5 text-muted-foreground" />}
        </TopBarButton>
      </div>
    </header>
  )
}
