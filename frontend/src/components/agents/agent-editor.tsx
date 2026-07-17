import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Bot, Loader2, Save, Settings2, Shield, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchAgentDetail, fetchProviders, fetchTools, createAgent, updateAgent, validateAgent } from "@/lib/api"
import { formDataToYaml, EMPTY_FORM } from "@/lib/agent-yaml"
import type { AgentFormData } from "@/lib/agent-yaml"
import type { ProviderInfo, ToolInfo } from "@/types/agent"
import { BasicTab, RuntimeTab, ToolsTab } from "./agent-editor-tabs"

interface AgentEditorPageProps {
  agentId?: string | null
  onBack: () => void
  onSaved?: (id: string) => void
}

export function AgentEditorPage({ agentId = null, onBack, onSaved }: AgentEditorPageProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AgentFormData>(EMPTY_FORM)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState("basic")
  const isCreate = !agentId

  useEffect(() => {
    fetchProviders().then(setProviders).catch(() => setProviders([]))
    fetchTools().then(setTools).catch(() => setTools([]))
  }, [])

  useEffect(() => {
    if (isCreate) {
      setForm(EMPTY_FORM)
      setError(null)
      return
    }
    setLoading(true)
    fetchAgentDetail(agentId!)
      .then((d) => setForm({
        id: d.id,
        name: d.name,
        provider: d.provider,
        model: d.model,
        systemPrompt: d.system_prompt || "",
        tools: d.tools || [],
        maxTurns: d.max_turns || 10,
        maxTokens: d.max_tokens || 4096,
        execMode: (d.tool_execution?.Mode as "parallel" | "serial") || "parallel",
        maxParallel: d.tool_execution?.MaxParallel || 4,
        autoApprove: d.permissions?.auto_approve || [],
        alwaysDeny: d.permissions?.always_deny || [],
      }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [agentId, isCreate])

  const handleSave = useCallback(async () => {
    setError(null)
    if (!form.name.trim()) { setError(t("agent.errNameRequired")); setTab("basic"); return }
    if (!form.provider) { setError(t("agent.errProviderRequired")); setTab("basic"); return }
    if (!form.model.trim()) { setError(t("agent.errModelRequired")); setTab("basic"); return }
    setSaving(true)
    try {
      const yaml = formDataToYaml(form)
      const v = await validateAgent(yaml)
      if (!v.valid) { setError(t("agent.errValidate", { message: v.message })); setSaving(false); return }
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
    { value: "runtime", icon: Settings2, label: t("agent.tabRuntime") },
  ] as const

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-xs" className="h-7 w-7 rounded-lg text-muted-foreground" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-heading text-base tracking-tight text-foreground">
              {isCreate ? t("agent.createTitle") : t("agent.editTitle", { name: form.name || agentId })}
            </h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t("agent.editorSubtitle")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs" onClick={onBack}>{t("common.cancel")}</Button>
          <Button size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("common.save")}
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-6 w-full rounded-xl bg-muted p-0.5">
                {tabs.map((item) => (
                  <TabsTrigger key={item.value} value={item.value} className="flex-1 gap-1.5 rounded-lg text-xs">
                    <item.icon className="h-3 w-3" /> {item.label}
                    {item.value === "tools" && form.tools.length > 0 && (
                      <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">{form.tools.length}</Badge>
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
                <BasicTab form={form} setForm={setForm} providers={providers} isCreate={isCreate} />
              </TabsContent>
              <TabsContent value="tools" className="mt-0">
                <ToolsTab form={form} setForm={setForm} tools={tools} />
              </TabsContent>
              <TabsContent value="runtime" className="mt-0">
                <RuntimeTab form={form} setForm={setForm} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  )
}
