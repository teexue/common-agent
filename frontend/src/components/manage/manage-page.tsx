import { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { useTranslation } from "react-i18next"
import {
  BookOpen,
  Bot,
  Brain,
  Copy,
  Info,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Plug,
  Puzzle,
  Server,
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
import { EmptyState } from "@/components/shared/empty-state"
import { ListRow } from "@/components/shared/list-row"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import {
  KnowledgeDetailPanel,
  KnowledgeListPanel,
} from "@/components/manage/knowledge-panel"
import { SkillsPanel } from "@/components/manage/skills-panel"
import { EmbeddingPanel } from "@/components/settings/embedding-panel"
import { McpPanel } from "@/components/settings/mcp-panel"
import { ProviderPanel } from "@/components/settings/provider-panel"
import { fetchAgents, fetchSkills, fetchTools } from "@/lib/api"
import { toolDisplayDescription, toolDisplayName } from "@/lib/tool-i18n"
import type { AgentInfo, SkillInfo, ToolInfo } from "@/types/agent"

interface ManagePageProps {
  onViewAgent?: (name: string) => void
  onEditAgent?: (name: string) => void
  onDeleteAgent?: (name: string) => void
  onCopyAgent?: (name: string) => void
  onCreateAgent?: () => void
  onSelectTool?: (tool: ToolInfo) => void
  agentsRefreshKey?: number
}

function AgentCard({
  agent,
  onView,
  onEdit,
  onCopy,
  onDelete,
}: {
  agent: AgentInfo
  onView?: (id: string) => void
  onEdit?: (id: string) => void
  onCopy?: (id: string) => void
  onDelete?: (id: string) => void
}) {
  const { t } = useTranslation()
  const agentKey = agent.id || agent.name
  return (
    <ListRow className="group flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{agent.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {agent.id && (
            <Badge
              variant="outline"
              className="rounded-md px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {agent.id}
            </Badge>
          )}
          <Badge
            variant="secondary"
            className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
          >
            {agent.provider}
          </Badge>
          {agent.model && (
            <Badge
              variant="outline"
              className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
            >
              {agent.model}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="rounded-md px-1.5 py-0.5 text-[10px]"
          >
            {t("manage.toolsCount", { count: (agent.tools ?? []).length })}
          </Badge>
        </div>
      </div>
      {(onView || onEdit || onCopy || onDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-7 w-7 rounded-lg opacity-0 transition-opacity group-hover:opacity-100"
              />
            }
          >
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36 rounded-xl">
            {onView && (
              <DropdownMenuItem
                onClick={() => onView(agentKey)}
                className="gap-2 text-xs"
              >
                <Info className="h-3.5 w-3.5" /> {t("layout.viewDetails")}
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem
                onClick={() => onEdit(agentKey)}
                className="gap-2 text-xs"
              >
                <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
              </DropdownMenuItem>
            )}
            {onCopy && (
              <DropdownMenuItem
                onClick={() => onCopy(agentKey)}
                className="gap-2 text-xs"
              >
                <Copy className="h-3.5 w-3.5" /> {t("common.copy")}
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(agentKey)}
                  className="gap-2 text-xs text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </ListRow>
  )
}

function ToolCard({
  tool,
  onSelect,
}: {
  tool: ToolInfo
  onSelect?: (tool: ToolInfo) => void
}) {
  const { t } = useTranslation()
  return (
    <ListRow
      onClick={() => onSelect?.(tool)}
      className="flex w-full items-start gap-3 text-left"
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Wrench className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {toolDisplayName(tool.name, t)}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {tool.name}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {toolDisplayDescription(tool.name, tool.description, t)}
        </p>
      </div>
    </ListRow>
  )
}

export function ManagePage({
  onViewAgent,
  onEditAgent,
  onDeleteAgent,
  onCopyAgent,
  onCreateAgent,
  onSelectTool,
  agentsRefreshKey = 0,
}: ManagePageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "agents"

  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [kbId, setKbId] = useState<string | null>(null)

  const reloadSkills = useCallback(() => {
    fetchSkills()
      .then((d) => setSkills(d ?? []))
      .catch(() => setSkills([]))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([
      fetchAgents()
        .then((d) => setAgents(d ?? []))
        .catch(() => setAgents([])),
      fetchTools()
        .then((d) => setTools(d ?? []))
        .catch(() => setTools([])),
      fetchSkills()
        .then((d) => setSkills(d ?? []))
        .catch(() => setSkills([])),
    ]).finally(() => setLoading(false))
  }, [agentsRefreshKey])

  const tabTriggers = [
    {
      value: "agents",
      icon: Bot,
      label: t("manage.tabAgents"),
      count: agents.length,
    },
    {
      value: "tools",
      icon: Wrench,
      label: t("manage.tabTools"),
      count: tools.length,
    },
    {
      value: "skills",
      icon: Puzzle,
      label: t("manage.tabSkills"),
      count: skills.length,
    },
    {
      value: "knowledge",
      icon: BookOpen,
      label: t("manage.tabKnowledge"),
      count: null,
    },
    {
      value: "providers",
      icon: Server,
      label: t("manage.tabProviders"),
      count: null,
    },
    {
      value: "embedding",
      icon: Brain,
      label: t("manage.tabEmbedding"),
      count: null,
    },
    {
      value: "mcp",
      icon: Plug,
      label: t("manage.tabMcp"),
      count: null,
    },
  ] as const

  const handleTabChange = (value: string) => {
    setKbId(null)
    setSearchParams(value === "agents" ? {} : { tab: value })
  }

  return (
    <PageShell>
      <PageHeader
        icon={Layers}
        title={t("manage.title")}
        onBack={() => navigate(-1)}
      />

      <PageMain contentClassName="w-full">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6 w-full rounded-xl bg-muted p-0.5">
            {tabTriggers.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 gap-1.5 rounded-lg text-xs"
              >
                <tab.icon className="h-3 w-3" />
                {tab.label}
                {tab.count != null && (
                  <Badge
                    variant="secondary"
                    className="rounded-md px-1.5 py-0 text-[10px]"
                  >
                    {tab.count}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="agents" className="mt-0 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {t("manage.agentsHint")}
              </p>
              {onCreateAgent && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={onCreateAgent}
                >
                  <Plus className="h-3.5 w-3.5" /> {t("common.createAgent")}
                </Button>
              )}
            </div>
            {loading ? (
              <EmptyState title={t("manage.loading")} />
            ) : agents.length === 0 ? (
              <EmptyState title={t("manage.agentsEmpty")} />
            ) : (
              agents.map((a) => (
                <AgentCard
                  key={a.id || a.name}
                  agent={a}
                  onView={onViewAgent}
                  onEdit={onEditAgent}
                  onCopy={onCopyAgent}
                  onDelete={onDeleteAgent}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="tools" className="mt-0 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              {t("manage.toolsHint")}
            </p>
            {loading ? (
              <EmptyState title={t("manage.loading")} />
            ) : tools.length === 0 ? (
              <EmptyState title={t("manage.toolsEmpty")} />
            ) : (
              tools.map((tool) => (
                <ToolCard key={tool.name} tool={tool} onSelect={onSelectTool} />
              ))
            )}
          </TabsContent>

          <TabsContent value="skills" className="mt-0">
            <SkillsPanel
              skills={skills}
              loading={loading}
              agents={agents}
              onRefresh={reloadSkills}
            />
          </TabsContent>

          <TabsContent value="knowledge" className="mt-0">
            {kbId ? (
              <KnowledgeDetailPanel kbId={kbId} onBack={() => setKbId(null)} />
            ) : (
              <KnowledgeListPanel onOpen={setKbId} />
            )}
          </TabsContent>

          <TabsContent value="providers" className="mt-0 space-y-4">
            <Section
              title={t("settings.providers")}
              icon={<Server className="h-3.5 w-3.5" />}
            >
              <ProviderPanel />
            </Section>
          </TabsContent>

          <TabsContent value="embedding" className="mt-0 space-y-4">
            <Section
              title={t("settings.embedding")}
              icon={<Brain className="h-3.5 w-3.5" />}
            >
              <EmbeddingPanel />
            </Section>
          </TabsContent>

          <TabsContent value="mcp" className="mt-0 space-y-4">
            <Section
              title={t("settings.mcpServers")}
              icon={<Plug className="h-3.5 w-3.5" />}
            >
              <McpPanel />
            </Section>
          </TabsContent>
        </Tabs>
      </PageMain>
    </PageShell>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}
