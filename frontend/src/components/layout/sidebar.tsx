import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Layers,
  MessageSquare,
  Plus,
  Settings,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ScenarioInfo, ToolInfo } from "@/types/agent"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  scenarios: ScenarioInfo[]
  selectedScenario: string
  onSelectScenario: (name: string) => void
  tools: ToolInfo[]
  onSelectTool: (tool: ToolInfo) => void
  onOpenSettings: () => void
  onNewSession?: () => void
}

export function Sidebar({
  collapsed,
  onToggle,
  scenarios,
  selectedScenario,
  onSelectScenario,
  tools,
  onSelectTool,
  onOpenSettings,
  onNewSession,
}: SidebarProps) {
  if (collapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center gap-1 border-r border-border bg-sidebar py-3">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onToggle}
                className="rounded-lg"
              />
            }
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="right">展开侧边栏</TooltipContent>
        </Tooltip>

        <Separator className="my-2 w-6" />

        {scenarios.map((sc) => (
          <Tooltip key={sc.name}>
            <TooltipTrigger
              render={
                <Button
                  variant={selectedScenario === sc.name ? "secondary" : "ghost"}
                  size="icon-xs"
                  onClick={() => onSelectScenario(sc.name)}
                  className="rounded-lg"
                />
              }
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="right">{sc.name}</TooltipContent>
          </Tooltip>
        ))}

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onOpenSettings}
                className="rounded-lg"
              />
            }
          >
            <Settings className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="right">设置</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="flex h-full w-60 flex-col border-r border-border bg-sidebar">
      {/* Header — brand */}
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <span className="font-heading text-sm tracking-tight text-foreground">
            common-agent
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onToggle}
          className="h-6 w-6 rounded-lg text-muted-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Separator />

      {/* New session */}
      <div className="p-2.5">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 rounded-xl text-xs text-muted-foreground"
          onClick={onNewSession}
        >
          <Plus className="h-3.5 w-3.5" />
          新建会话
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        {/* Scenarios */}
        <div className="p-2.5">
          <div className="mb-2 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            <Layers className="h-3 w-3" />
            场景
          </div>
          <div className="flex flex-col gap-0.5">
            {scenarios.map((sc) => (
              <button
                key={sc.name}
                onClick={() => onSelectScenario(sc.name)}
                className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all ${
                  selectedScenario === sc.name
                    ? "bg-primary/8 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    selectedScenario === sc.name
                      ? "bg-primary"
                      : "bg-muted-foreground/25 group-hover:bg-primary/40"
                  }`}
                />
                <span className="flex-1 truncate text-xs font-medium">
                  {sc.name}
                </span>
                <Badge
                  variant="outline"
                  className={`shrink-0 border-0 text-[9px] ${
                    selectedScenario === sc.name
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {sc.tools.length}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        <Separator className="mx-2.5" />

        {/* Tools */}
        <div className="p-2.5">
          <div className="mb-2 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            <Wrench className="h-3 w-3" />
            工具
          </div>
          <div className="flex flex-col gap-0.5">
            {tools.map((tool) => (
              <button
                key={tool.name}
                onClick={() => onSelectTool(tool)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all hover:bg-sidebar-accent"
              >
                <Wrench className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-sidebar-foreground">
                    {tool.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>

      <Separator />

      {/* Footer */}
      <div className="p-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 rounded-xl text-xs text-muted-foreground"
          onClick={onOpenSettings}
        >
          <Settings className="h-3.5 w-3.5" />
          设置
        </Button>
      </div>
    </div>
  )
}
