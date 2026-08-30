import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "react-router"
import { useTranslation } from "react-i18next"
import {
  BookOpen,
  Bot,
  Brain,
  Layers,
  Plug,
  Puzzle,
  Server,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { fetchSkills, fetchTools } from "@/lib/api"
import type { AgentInfo, SkillInfo, ToolInfo } from "@/types/agent"
import {
  ManageAgentsPane,
  ManageKnowledgePane,
  ManageSettingsPanes,
  ManageSkillsPane,
  ManageToolsPane,
} from "./manage-panes"

interface ManagePageProps {
  agents: AgentInfo[]
  onViewAgent?: (name: string) => void
  onEditAgent?: (name: string) => void
  onDeleteAgent?: (name: string) => void
  onCopyAgent?: (name: string) => void
  onCreateAgent?: () => void
  onSelectTool?: (tool: ToolInfo) => void
  onEditSkill?: (skill: SkillInfo) => void
  onCreateSkill?: () => void
}

export function ManagePage(props: ManagePageProps) {
  const { t } = useTranslation()
  const data = useManageData()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "agents"
  const [kbId, setKbId] = useState<string | null>(null)

  return (
    <PageShell>
      <PageHeader icon={Layers} title={t("manage.title")} />
      <PageMain
        className="overflow-hidden"
        contentClassName="flex h-full min-h-0 w-full p-0"
      >
        <Tabs
          orientation="vertical"
          value={activeTab}
          onValueChange={(value) => {
            setKbId(null)
            setSearchParams(value === "agents" ? {} : { tab: value })
          }}
          className="h-full min-h-0 w-full gap-0"
        >
          <ManageTabNav
            agents={props.agents.length}
            tools={data.tools.length}
            skills={data.skills.length}
          />
          <div className="min-h-0 min-w-0 flex-1 overflow-auto px-6 py-6">
            <ManageAgentsPane {...props} {...data} agents={props.agents} />
            <ManageToolsPane {...props} {...data} />
            <ManageSkillsPane
              {...props}
              {...data}
              reloadSkills={data.reloadSkills}
            />
            <ManageKnowledgePane kbId={kbId} setKbId={setKbId} />
            <ManageSettingsPanes />
          </div>
        </Tabs>
      </PageMain>
    </PageShell>
  )
}

function ManageTabNav({
  agents,
  tools,
  skills,
}: {
  agents: number
  tools: number
  skills: number
}) {
  const { t } = useTranslation()
  const tabs = [
    { value: "agents", icon: Bot, label: t("manage.tabAgents"), count: agents },
    { value: "tools", icon: Wrench, label: t("manage.tabTools"), count: tools },
    {
      value: "skills",
      icon: Puzzle,
      label: t("manage.tabSkills"),
      count: skills,
    },
    { value: "knowledge", icon: BookOpen, label: t("manage.tabKnowledge") },
    { value: "providers", icon: Server, label: t("manage.tabProviders") },
    { value: "embedding", icon: Brain, label: t("manage.tabEmbedding") },
    { value: "mcp", icon: Plug, label: t("manage.tabMcp") },
  ] as const
  return (
    <TabsList
      variant="line"
      className="h-full w-48 shrink-0 flex-col items-stretch justify-start gap-0.5 rounded-none border-r border-border bg-transparent p-3"
    >
      {tabs.map((tab) => (
        <TabsTrigger
          key={tab.value}
          value={tab.value}
          className="h-9 w-full flex-none justify-start gap-2 rounded-lg px-2.5 text-xs after:hidden data-active:bg-primary/10 data-active:text-primary data-active:shadow-none"
        >
          <tab.icon className="h-3.5 w-3.5" />
          {tab.label}
          {"count" in tab && (
            <Badge
              variant="secondary"
              className="ml-auto rounded-md px-1.5 py-0 text-[10px]"
            >
              {tab.count}
            </Badge>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}

function useManageData() {
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)

  const reloadSkills = useCallback(() => {
    fetchSkills()
      .then((d) => setSkills(d ?? []))
      .catch(() => setSkills([]))
  }, [])

  useEffect(() => {
    Promise.all([
      fetchTools()
        .then((d) => setTools(d ?? []))
        .catch(() => setTools([])),
      fetchSkills()
        .then((d) => setSkills(d ?? []))
        .catch(() => setSkills([])),
    ]).finally(() => setLoading(false))
  }, [])

  return { tools, skills, loading, reloadSkills }
}
