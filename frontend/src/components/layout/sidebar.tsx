import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
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
import type { AgentInfo, SessionMeta, ToolInfo } from "@/types/agent"
import { formatRelativeTime } from "@/lib/format"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  agents: AgentInfo[]
  selectedAgent: string
  onSelectAgent: (name: string) => void
  tools: ToolInfo[]
  onSelectTool: (tool: ToolInfo) => void
  onOpenSettings: () => void
  onNewSession?: () => void
  // Session props
  sessions?: SessionMeta[]
  activeSessionId?: string | null
  onResumeSession?: (id: string) => void
  onDeleteSession?: (id: string) => void
}

export function Sidebar({
  collapsed,
  onToggle,
  agents,
  selectedAgent,
  onSelectAgent,
  tools,
  onSelectTool,
  onOpenSettings,
  onNewSession,
  sessions = [],
  activeSessionId,
  onResumeSession,
  onDeleteSession,
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

        {agents.map((a) => (
          <Tooltip key={a.name}>
            <TooltipTrigger
              render={
                <Button
                  variant={selectedAgent === a.name ? "secondary" : "ghost"}
                  size="icon-xs"
                  onClick={() => onSelectAgent(a.name)}
                  className="rounded-lg"
                />
              }
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="right">{a.name}</TooltipContent>
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
        {/* Sessions history */}
        {sessions.length > 0 && (
          <>
            <div className="p-2.5">
              <div className="mb-2 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                <Clock className="h-3 w-3" />
                历史会话
              </div>
              <div className="flex flex-col gap-0.5">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all ${
                      activeSessionId === sess.id
                        ? "bg-primary/8 text-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <button
                      onClick={() => onResumeSession?.(sess.id)}
                      className="flex min-w-0 flex-1 items-center gap-2"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                          activeSessionId === sess.id
                            ? "bg-primary"
                            : "bg-muted-foreground/25 group-hover:bg-primary/40"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                          {sess.agent}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {formatRelativeTime(sess.updated_at)}
                        </span>
                      </div>
                    </button>
                    {onDeleteSession && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteSession(sess.id)
                              }}
                              className="h-5 w-5 shrink-0 rounded-md opacity-0 transition-opacity group-hover:opacity-100"
                            />
                          }
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent side="right">删除会话</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator className="mx-2.5" />
          </>
        )}

        {/* Agents */}
        <div className="p-2.5">
          <div className="mb-2 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            <Layers className="h-3 w-3" />
            Agent
          </div>
          <div className="flex flex-col gap-0.5">
            {agents.map((a) => (
              <button
                key={a.name}
                onClick={() => onSelectAgent(a.name)}
                className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all ${
                  selectedAgent === a.name
                    ? "bg-primary/8 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    selectedAgent === a.name
                      ? "bg-primary"
                      : "bg-muted-foreground/25 group-hover:bg-primary/40"
                  }`}
                />
                <span className="flex-1 truncate text-xs font-medium">
                  {a.name}
                </span>
                <Badge
                  variant="outline"
                  className={`shrink-0 border-0 text-[9px] ${
                    selectedAgent === a.name
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.tools.length}
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
