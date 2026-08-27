import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Bot,
  Loader2,
  Plug,
  Save,
  Settings2,
  Shield,
  Wrench,
} from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  fetchAgentDetail,
  fetchKnowledgeBases,
  fetchProviders,
  fetchTools,
  createAgent,
  updateAgent,
  validateAgent,
} from "@/lib/api"
import { EMPTY_FORM, formDataToYaml, mcpConfigToForm } from "@/lib/agent-yaml"
import type { AgentFormData } from "@/lib/agent-yaml"
import type { AgentDetail, ProviderInfo, ToolInfo } from "@/types/agent"
import { BasicTab } from "./tabs/basic-tab"
import { McpTab } from "./tabs/mcp-tab"
import { RuntimeTab } from "./tabs/runtime-tab"
import { ToolsTab } from "./tabs/tools-tab"

interface AgentEditorPageProps {
  agentId?: string | null
  copyFrom?: string | null
  onBack: () => void
  onSaved?: (id: string) => void
}

// agentDetailToForm maps a backend AgentDetail into the editable form shape.
// Shared by edit mode and copy-seed mode.
function agentDetailToForm(d: AgentDetail): AgentFormData {
  return {
    id: d.id,
    name: d.name,
    provider: d.provider,
    model: d.model,
    systemPrompt: d.system_prompt || "",
    tools: d.tools || [],
    maxTurns: d.max_turns ?? 0,
    maxTokens: d.max_tokens ?? 0,
    execMode: (d.tool_execution?.Mode as "parallel" | "serial") || "parallel",
    maxParallel: d.tool_execution?.MaxParallel || 4,
    autoApprove:
      d.permissions == null
        ? d.tools || []
        : d.permissions.auto_approve || [],
    alwaysDeny: d.permissions?.always_deny || [],
    mcpServers: (d.mcp_servers ?? []).map(mcpConfigToForm),
    knowledgeBases: d.knowledge?.bases ?? [],
    knowledgeTopK: d.knowledge?.top_k || 5,
    optimizeUserPrompt: d.optimize?.user_prompt ?? false,
    contextWindow: d.compaction?.context_window ?? 0,
    compactionStrategy:
      (d.compaction?.strategy as AgentFormData["compactionStrategy"]) ??
      "truncation",
  }
}

export function AgentEditorPage({
  agentId = null,
  copyFrom = null,
  onBack,
  onSaved,
}: AgentEditorPageProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AgentFormData>(EMPTY_FORM)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [knowledgeBases, setKnowledgeBases] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState("basic")
  const isCreate = !agentId

  useEffect(() => {
    fetchProviders()
      .then(setProviders)
      .catch(() => setProviders([]))
    fetchTools()
      .then(setTools)
      .catch(() => setTools([]))
    fetchKnowledgeBases()
      .then((bases) =>
        setKnowledgeBases(bases.map((b) => ({ id: b.id, name: b.name })))
      )
      .catch(() => setKnowledgeBases([]))
  }, [])

  useEffect(() => {
    if (isCreate) {
      if (copyFrom) {
        // Seed a new agent from an existing one's settings.
        setLoading(true)
        fetchAgentDetail(copyFrom)
          .then((d) =>
            setForm({
              ...agentDetailToForm(d),
              id: "",
              name: `${d.name}-copy`,
            })
          )
          .catch((err) => setError(err.message))
          .finally(() => setLoading(false))
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setForm(EMPTY_FORM)
        setError(null)
      }
      return
    }
    setLoading(true)
    fetchAgentDetail(agentId!)
      .then((d) => setForm(agentDetailToForm(d)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [agentId, isCreate, copyFrom])

  const handleSave = useCallback(async () => {
    setError(null)
    if (!form.name.trim()) {
      setError(t("agent.errNameRequired"))
      setTab("basic")
      return
    }
    if (!form.provider) {
      setError(t("agent.errProviderRequired"))
      setTab("basic")
      return
    }
    if (!form.model.trim()) {
      setError(t("agent.errModelRequired"))
      setTab("basic")
      return
    }
    setSaving(true)
    try {
      const yaml = formDataToYaml(form)
      const v = await validateAgent(yaml)
      if (!v.valid) {
        setError(t("agent.errValidate", { message: v.message }))
        setSaving(false)
        return
      }
      if (isCreate) {
        const created = await createAgent(yaml)
        onSaved?.(created.id)
      } else {
        await updateAgent(agentId!, yaml)
        onSaved?.(agentId!)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("agent.errSave"))
    } finally {
      setSaving(false)
    }
  }, [form, onSaved, t, isCreate, agentId])

  const tabs = [
    { value: "basic", icon: Bot, label: t("agent.tabBasic") },
    { value: "tools", icon: Wrench, label: t("agent.tabTools") },
    { value: "mcp", icon: Plug, label: t("agent.tabMcp") },
    { value: "runtime", icon: Settings2, label: t("agent.tabRuntime") },
  ] as const

  return (
    <PageShell>
      <PageHeader
        icon={Bot}
        title={
          isCreate
            ? copyFrom
              ? t("agent.copyTitle", { name: copyFrom })
              : t("agent.createTitle")
            : t("agent.editTitle", { name: form.name || agentId })
        }
        description={t("agent.editorSubtitle")}
        onBack={onBack}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={onBack}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {t("common.save")}
            </Button>
          </>
        }
      />

      <PageMain contentClassName="mx-auto max-w-3xl">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6 w-full rounded-xl bg-muted p-0.5">
              {tabs.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="flex-1 gap-1.5 rounded-lg text-xs"
                >
                  <item.icon className="h-3 w-3" /> {item.label}
                  {item.value === "tools" && form.tools.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="rounded-md px-1.5 py-0 text-[10px]"
                    >
                      {form.tools.length}
                    </Badge>
                  )}
                  {item.value === "mcp" && form.mcpServers.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="rounded-md px-1.5 py-0 text-[10px]"
                    >
                      {form.mcpServers.length}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <TabsContent value="basic" className="mt-0">
              <BasicTab
                form={form}
                setForm={setForm}
                providers={providers}
                isCreate={isCreate}
              />
            </TabsContent>
            <TabsContent value="tools" className="mt-0">
              <ToolsTab form={form} setForm={setForm} tools={tools} />
            </TabsContent>
            <TabsContent value="mcp" className="mt-0">
              <McpTab form={form} setForm={setForm} />
            </TabsContent>
            <TabsContent value="runtime" className="mt-0">
              <RuntimeTab
                form={form}
                setForm={setForm}
                knowledgeBases={knowledgeBases}
              />
            </TabsContent>
          </Tabs>
        )}
      </PageMain>
    </PageShell>
  )
}
