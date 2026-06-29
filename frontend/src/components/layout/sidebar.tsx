import {
  Bot,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Puzzle,
  Settings,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AgentInfo, SessionMeta, SkillInfo, ToolInfo } from "@/types/agent"
import { SessionList } from "./sidebar-session-list"
import { AgentList } from "./sidebar-agent-list"

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
  sessions?: SessionMeta[]
  activeSessionId?: string | null
  onResumeSession?: (id: string) => void
  onDeleteSession?: (id: string) => void
  onViewAgent?: (name: string) => void
  onEditAgent?: (name: string) => void
  onDeleteAgent?: (name: string) => void
  onCreateAgent?: () => void
  skills?: SkillInfo[]
  onReplaySession?: (id: string) => void
}

function CollapsedSidebar({
  onToggle, agents, selectedAgent, onSelectAgent, onOpenSettings,
}: Pick<SidebarProps, "onToggle" | "agents" | "selectedAgent" | "onSelectAgent" | "onOpenSettings">) {
  return (
    <div className="flex h-full w-12 flex-col items-center gap-1 border-r border-border bg-sidebar py-3">
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={onToggle} className="rounded-lg" />}>
          <ChevronRight className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent side="right">展开侧边栏</TooltipContent>
      </Tooltip>
      <Separator className="my-2 w-6" />
      {agents.map((a) => (
        <Tooltip key={a.name}>
          <TooltipTrigger render={<Button variant={selectedAgent === a.name ? "secondary" : "ghost"} size="icon-xs" onClick={() => onSelectAgent(a.name)} className="rounded-lg" />}>
            <MessageSquare className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="right">{a.name}</TooltipContent>
        </Tooltip>
      ))}
      <div className="flex-1" />
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={onOpenSettings} className="rounded-lg" />}>
          <Settings className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent side="right">设置</TooltipContent>
      </Tooltip>
    </div>
  )
}

function ToolsSection({ tools, onSelectTool }: { tools: ToolInfo[]; onSelectTool: (t: ToolInfo) => void }) {
  return (
    <div className="p-2.5">
      <div className="mb-2 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        <Wrench className="h-3 w-3" /> 工具
      </div>
      <div className="flex flex-col gap-0.5">
        {tools.map((tool) => (
          <button key={tool.name} onClick={() => onSelectTool(tool)} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all hover:bg-sidebar-accent">
            <Wrench className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-sidebar-foreground">{tool.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function SkillsSection({ skills }: { skills: SkillInfo[] }) {
  if (skills.length === 0) return null
  return (
    <>
      <Separator className="mx-2.5" />
      <div className="p-2.5">
        <div className="mb-2 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          <Puzzle className="h-3 w-3" /> 技能
        </div>
        <div className="flex flex-col gap-0.5">
          {skills.map((sk) => (
            <div key={sk.name} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2">
              <Puzzle className="h-3 w-3 shrink-0 text-muted-foreground/60" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-sidebar-foreground">{sk.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{(sk.tools ?? []).length} 工具 · v{sk.version}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export function Sidebar({
  collapsed, onToggle, agents = [], selectedAgent, onSelectAgent,
  tools = [], onSelectTool, onOpenSettings, onNewSession,
  sessions = [], activeSessionId, onResumeSession, onDeleteSession,
  onViewAgent, onEditAgent, onDeleteAgent, onCreateAgent,
  skills = [], onReplaySession,
}: SidebarProps) {
  if (collapsed) {
    return <CollapsedSidebar {...{ onToggle, agents, selectedAgent, onSelectAgent, onOpenSettings }} />
  }

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-sidebar overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <span className="font-heading text-sm tracking-tight text-foreground">common-agent</span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onToggle} className="h-6 w-6 rounded-lg text-muted-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Separator />

      <div className="p-2.5">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 rounded-xl text-xs text-muted-foreground" onClick={onNewSession}>
          <Plus className="h-3.5 w-3.5" /> 新建会话
        </Button>
      </div>

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <SessionList sessions={sessions} activeSessionId={activeSessionId} onResumeSession={onResumeSession} onDeleteSession={onDeleteSession} onReplaySession={onReplaySession} />
        {sessions.length > 0 && <Separator className="mx-2.5" />}
        <AgentList agents={agents} selectedAgent={selectedAgent} onSelectAgent={onSelectAgent} onViewAgent={onViewAgent} onEditAgent={onEditAgent} onDeleteAgent={onDeleteAgent} onCreateAgent={onCreateAgent} />
        <Separator className="mx-2.5" />
        <ToolsSection tools={tools} onSelectTool={onSelectTool} />
        <SkillsSection skills={skills} />
      </ScrollArea>

      <Separator />

      <div className="p-2.5">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 rounded-xl text-xs text-muted-foreground" onClick={onOpenSettings}>
          <Settings className="h-3.5 w-3.5" /> 设置
        </Button>
      </div>
    </div>
  )
}
