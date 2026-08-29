import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import type { AgentInfo, SkillInfo, ToolInfo } from "@/types/agent"
import { AgentCard } from "./manage-agent-card"
import { ToolCard } from "./manage-tool-card"
import {
  KnowledgeDetailPanel,
  KnowledgeListPanel,
} from "@/components/manage/knowledge-panel"
import { SkillsPanel } from "@/components/manage/skills-panel"
import { EmbeddingPanel } from "@/components/settings/embedding-panel"
import { McpPanel } from "@/components/settings/mcp-panel"
import { ProviderPanel } from "@/components/settings/provider-panel"
import { Brain, Plug, Server } from "lucide-react"
import { TabsContent } from "@/components/ui/tabs"

interface ManagePanesProps {
  loading: boolean
  agents: AgentInfo[]
  tools: ToolInfo[]
  skills: SkillInfo[]
  kbId: string | null
  setKbId: (id: string | null) => void
  reloadSkills: () => void
  onViewAgent?: (name: string) => void
  onEditAgent?: (name: string) => void
  onDeleteAgent?: (name: string) => void
  onCopyAgent?: (name: string) => void
  onCreateAgent?: () => void
  onSelectTool?: (tool: ToolInfo) => void
  onEditSkill?: (skill: SkillInfo) => void
  onCreateSkill?: () => void
}

export function ManageAgentsPane({
  loading,
  agents,
  onViewAgent,
  onEditAgent,
  onCopyAgent,
  onDeleteAgent,
  onCreateAgent,
}: Pick<
  ManagePanesProps,
  | "loading"
  | "agents"
  | "onViewAgent"
  | "onEditAgent"
  | "onCopyAgent"
  | "onDeleteAgent"
  | "onCreateAgent"
>) {
  const { t } = useTranslation()
  return (
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
  )
}

export function ManageToolsPane({
  loading,
  tools,
  onSelectTool,
}: Pick<ManagePanesProps, "loading" | "tools" | "onSelectTool">) {
  const { t } = useTranslation()
  return (
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
  )
}

export function ManageSkillsPane({
  skills,
  loading,
  agents,
  reloadSkills,
  onEditSkill,
  onCreateSkill,
}: Pick<
  ManagePanesProps,
  | "skills"
  | "loading"
  | "agents"
  | "reloadSkills"
  | "onEditSkill"
  | "onCreateSkill"
>) {
  return (
    <TabsContent value="skills" className="mt-0">
      <SkillsPanel
        skills={skills}
        loading={loading}
        agents={agents}
        onRefresh={reloadSkills}
        onEditSkill={onEditSkill}
        onCreateSkill={onCreateSkill}
      />
    </TabsContent>
  )
}

export function ManageKnowledgePane({
  kbId,
  setKbId,
}: Pick<ManagePanesProps, "kbId" | "setKbId">) {
  return (
    <TabsContent value="knowledge" className="mt-0">
      {kbId ? (
        <KnowledgeDetailPanel
          key={kbId}
          kbId={kbId}
          onBack={() => setKbId(null)}
        />
      ) : (
        <KnowledgeListPanel onOpen={setKbId} />
      )}
    </TabsContent>
  )
}

export function ManageSettingsPanes() {
  const { t } = useTranslation()
  return (
    <>
      <TabsContent value="providers" className="mt-0 space-y-4">
        <ManageSection
          title={t("settings.providers")}
          icon={<Server className="h-3.5 w-3.5" />}
        >
          <ProviderPanel />
        </ManageSection>
      </TabsContent>
      <TabsContent value="embedding" className="mt-0 space-y-4">
        <ManageSection
          title={t("settings.embedding")}
          icon={<Brain className="h-3.5 w-3.5" />}
        >
          <EmbeddingPanel />
        </ManageSection>
      </TabsContent>
      <TabsContent value="mcp" className="mt-0 space-y-4">
        <ManageSection
          title={t("settings.mcpServers")}
          icon={<Plug className="h-3.5 w-3.5" />}
        >
          <McpPanel />
        </ManageSection>
      </TabsContent>
    </>
  )
}

function ManageSection({
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
