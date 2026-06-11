import { Moon, PanelRightClose, PanelRightOpen, Sun } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { StatusIndicator } from "@/components/shared/status-indicator"
import type { ScenarioInfo, StreamStatus } from "@/types/agent"

interface TopBarProps {
  scenario: ScenarioInfo
  status: StreamStatus
  artifactOpen: boolean
  onToggleArtifact: () => void
  theme: string
  onToggleTheme: () => void
}

export function TopBar({
  scenario,
  status,
  artifactOpen,
  onToggleArtifact,
  theme,
  onToggleTheme,
}: TopBarProps) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <span className="font-heading text-sm tracking-tight text-foreground">
          {scenario.name}
        </span>
        {scenario.model && (
          <Badge
            variant="secondary"
            className="rounded-md px-1.5 py-0 text-[10px] font-mono"
          >
            {scenario.model}
          </Badge>
        )}
        <StatusIndicator status={status} />
      </div>

      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onToggleTheme}
                className="h-7 w-7 rounded-lg"
              />
            }
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </TooltipTrigger>
          <TooltipContent>切换主题</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onToggleArtifact}
                className="h-7 w-7 rounded-lg"
              />
            }
          >
            {artifactOpen ? (
              <PanelRightClose className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </TooltipTrigger>
          <TooltipContent>
            {artifactOpen ? "关闭检查器" : "打开检查器"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
