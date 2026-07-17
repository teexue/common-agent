import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  ArrowLeft,
  Bot,
  Info,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Puzzle,
  Trash2,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchAgents, fetchSkills, fetchTools } from "@/lib/api"
import type { AgentInfo, SkillInfo, ToolInfo } from "@/types/agent"

interface ManagePageProps {
  onViewAgent?: (name: string) => void
  onEditAgent?: (name: string) => void
  onDeleteAgent?: (name: string) => void
  onCreateAgent?: () => void
  onSelectTool?: (tool: ToolInfo) => void
  agentsRefreshKey?: number
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-10">
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

function AgentCard({
  agent, onView, onEdit, onDelete,
}: {
  agent: AgentInfo
  onView?: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}) {
  const { t } = useTranslation()
  const agentKey = agent.id || agent.name
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/20 hover:bg-muted/30">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{agent.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {agent.id && (
            <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{agent.id}</Badge>
          )}
          <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 text-[10px] font-mono">{agent.provider}</Badge>
          {agent.model && <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px] font-mono">{agent.model}</Badge>}
          <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px]">{t("manage.toolsCount", { count: (agent.tools ?? []).length })}</Badge>
        </div>
      </div>
      {(onView || onEdit || onDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="h-7 w-7 rounded-lg opacity-0 transition-opacity group-hover:opacity-100" />}>
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36 rounded-xl">
            {onView && (
              <DropdownMenuItem onClick={() => onView(agentKey)} className="gap-2 text-xs">
                <Info className="h-3.5 w-3.5" /> {t("layout.viewDetails")}
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(agentKey)} className="gap-2 text-xs">
                <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(agentKey)} className="gap-2 text-xs text-destructive focus:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function ToolCard({ tool, onSelect }: { tool: ToolInfo; onSelect?: (tool: ToolInfo) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(tool)}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/20 hover:bg-muted/30"
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Wrench className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-medium text-foreground">{tool.name}</p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{tool.description}</p>
      </div>
    </button>
  )
}

function SkillCard({ skill }: { skill: SkillInfo }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Puzzle className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{skill.name}</p>
          {skill.version && (
            <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] font-mono">v{skill.version}</Badge>
          )}
        </div>
        {skill.description && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{skill.description}</p>
        )}
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {t("manage.toolsCount", { count: (skill.tools ?? []).length })}
          {skill.format ? ` · ${skill.format}` : ""}
        </p>
      </div>
    </div>
  )
}

export function ManagePage({
  onViewAgent, onEditAgent, onDeleteAgent, onCreateAgent, onSelectTool, agentsRefreshKey = 0,
}: ManagePageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "agents"

  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchAgents().then((d) => setAgents(d ?? [])).catch(() => setAgents([])),
      fetchTools().then((d) => setTools(d ?? [])).catch(() => setTools([])),
      fetchSkills().then((d) => setSkills(d ?? [])).catch(() => setSkills([])),
    ]).finally(() => setLoading(false))
  }, [agentsRefreshKey])

  const tabTriggers = [
    { value: "agents", icon: Bot, label: t("manage.tabAgents"), count: agents.length },
    { value: "tools", icon: Wrench, label: t("manage.tabTools"), count: tools.length },
    { value: "skills", icon: Puzzle, label: t("manage.tabSkills"), count: skills.length },
  ] as const

  const handleTabChange = (value: string) => {
    setSearchParams(value === "agents" ? {} : { tab: value })
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon-xs" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h1 className="font-heading text-base tracking-tight text-foreground">{t("manage.title")}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-6 w-full rounded-xl bg-muted p-0.5">
              {tabTriggers.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="flex-1 gap-1.5 rounded-lg text-xs">
                  <tab.icon className="h-3 w-3" />
                  {tab.label}
                  <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">{tab.count}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="agents" className="mt-0 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">{t("manage.agentsHint")}</p>
                {onCreateAgent && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={onCreateAgent}>
                    <Plus className="h-3.5 w-3.5" /> {t("common.createAgent")}
                  </Button>
                )}
              </div>
              {loading ? <EmptyState text={t("manage.loading")} /> : agents.length === 0 ? (
                <EmptyState text={t("manage.agentsEmpty")} />
              ) : (
                agents.map((a) => (
                  <AgentCard key={a.id || a.name} agent={a} onView={onViewAgent} onEdit={onEditAgent} onDelete={onDeleteAgent} />
                ))
              )}
            </TabsContent>

            <TabsContent value="tools" className="mt-0 space-y-3">
              <p className="text-[11px] text-muted-foreground">{t("manage.toolsHint")}</p>
              {loading ? <EmptyState text={t("manage.loading")} /> : tools.length === 0 ? (
                <EmptyState text={t("manage.toolsEmpty")} />
              ) : (
                tools.map((tool) => <ToolCard key={tool.name} tool={tool} onSelect={onSelectTool} />)
              )}
            </TabsContent>

            <TabsContent value="skills" className="mt-0 space-y-3">
              <p className="text-[11px] text-muted-foreground">{t("manage.skillsHint")}</p>
              {loading ? <EmptyState text={t("manage.loading")} /> : skills.length === 0 ? (
                <EmptyState text={t("manage.skillsEmpty")} />
              ) : (
                skills.map((sk) => <SkillCard key={sk.name} skill={sk} />)
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
