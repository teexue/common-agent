import { useTranslation } from "react-i18next"
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Layers,
  Plus,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AgentInfo, SessionMeta } from "@/types/agent"
import { SidebarJobsList } from "./sidebar-jobs-list"
import { SessionList } from "./sidebar-session-list"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onOpenSettings: () => void
  onOpenManage?: () => void
  onNewSession?: () => void
  sessions?: SessionMeta[]
  agents?: AgentInfo[]
  activeSessionId?: string | null
  onResumeSession?: (id: string) => void
  onDeleteSession?: (id: string) => void
  onReplaySession?: (id: string) => void
}

function CollapsedSidebar({
  onToggle, onOpenSettings, onOpenManage, onNewSession,
}: Pick<SidebarProps, "onToggle" | "onOpenSettings" | "onOpenManage" | "onNewSession">) {
  const { t } = useTranslation()
  return (
    <div className="flex h-full w-12 flex-col items-center gap-1 border-r border-border bg-sidebar py-3">
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={onToggle} className="rounded-lg" />}>
          <ChevronRight className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent side="right">{t("layout.expandSidebar")}</TooltipContent>
      </Tooltip>
      <Separator className="my-2 w-6" />
      {onNewSession && (
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={onNewSession} className="rounded-lg" />}>
            <Plus className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="right">{t("layout.newSession")}</TooltipContent>
        </Tooltip>
      )}
      <div className="flex-1" />
      {onOpenManage && (
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={onOpenManage} className="rounded-lg" />}>
            <Layers className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="right">{t("layout.manage")}</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={onOpenSettings} className="rounded-lg" />}>
          <Settings className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent side="right">{t("common.settings")}</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function Sidebar({
  collapsed, onToggle, onOpenSettings, onOpenManage, onNewSession,
  sessions = [], agents = [], activeSessionId, onResumeSession, onDeleteSession, onReplaySession,
}: SidebarProps) {
  const { t } = useTranslation()
  if (collapsed) {
    return <CollapsedSidebar {...{ onToggle, onOpenSettings, onOpenManage, onNewSession }} />
  }

  const agentLabels: Record<string, string> = {}
  for (const a of agents) {
    if (a.id) agentLabels[a.id] = a.name
    agentLabels[a.name] = a.name
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
          <Plus className="h-3.5 w-3.5" /> {t("layout.newSession")}
        </Button>
      </div>

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <SidebarJobsList />
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onResumeSession={onResumeSession}
          onDeleteSession={onDeleteSession}
          onReplaySession={onReplaySession}
          agentLabels={agentLabels}
        />
      </ScrollArea>

      <Separator />

      <div className="flex flex-col gap-0.5 p-2.5">
        {onOpenManage && (
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 rounded-xl text-xs text-muted-foreground" onClick={onOpenManage}>
            <Layers className="h-3.5 w-3.5" /> {t("layout.manage")}
          </Button>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 rounded-xl text-xs text-muted-foreground" onClick={onOpenSettings}>
          <Settings className="h-3.5 w-3.5" /> {t("common.settings")}
        </Button>
      </div>
    </div>
  )
}
