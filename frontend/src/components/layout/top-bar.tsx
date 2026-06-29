import { Moon, PanelRightClose, PanelRightOpen, Sun } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

export function TopBar({
  agent, status, artifactOpen, onToggleArtifact, theme, onToggleTheme,
}: TopBarProps) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <span className="font-heading text-sm tracking-tight text-foreground">{agent.name}</span>
        {agent.model && (
          <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px] font-mono">{agent.model}</Badge>
        )}
        <StatusIndicator status={status} />
      </div>

      <div className="flex items-center gap-0.5">
        <HealthIndicator />
        <TopBarButton tooltip="切换主题" onClick={onToggleTheme}>
          {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-muted-foreground" /> : <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
        </TopBarButton>
        <TopBarButton tooltip={artifactOpen ? "关闭检查器" : "打开检查器"} onClick={onToggleArtifact}>
          {artifactOpen ? <PanelRightClose className="h-3.5 w-3.5 text-muted-foreground" /> : <PanelRightOpen className="h-3.5 w-3.5 text-muted-foreground" />}
        </TopBarButton>
      </div>
    </header>
  )
}
