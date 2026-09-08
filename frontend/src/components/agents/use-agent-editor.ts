import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  createAgent,
  fetchAgentDetail,
  fetchKnowledgeBases,
  fetchProviders,
  fetchTools,
  updateAgent,
  validateAgent,
} from "@/lib/api"
import { EMPTY_FORM, formDataToYaml, mcpConfigToForm } from "@/lib/agent-yaml"
import type { AgentFormData } from "@/lib/agent-yaml"
import { stripHiddenPickerTools } from "@/lib/tool-visibility"
import type { AgentDetail, ProviderInfo, ToolInfo } from "@/types/agent"

export function agentDetailToForm(d: AgentDetail): AgentFormData {
  return {
    id: d.id,
    name: d.name,
    provider: d.provider,
    model: d.model,
    systemPrompt: d.system_prompt || "",
    tools: stripHiddenPickerTools(d.tools || []),
    ...formRuntime(d),
    ...formPermissions(d),
    mcpServers: (d.mcp_servers ?? []).map(mcpConfigToForm),
    ...formKnowledge(d),
  }
}

function formRuntime(d: AgentDetail) {
  return {
    maxTurns: d.max_turns ?? 0,
    maxTokens: d.max_tokens ?? 0,
    execMode: (d.tool_execution?.Mode as "parallel" | "serial") || "parallel",
    maxParallel: d.tool_execution?.MaxParallel || 4,
    contextWindow: d.compaction?.context_window ?? 0,
  }
}

function formPermissions(d: AgentDetail) {
  const tools = stripHiddenPickerTools(d.tools || [])
  return {
    autoApprove: stripHiddenPickerTools(
      d.permissions == null ? tools : d.permissions.auto_approve || []
    ),
    alwaysDeny: stripHiddenPickerTools(d.permissions?.always_deny || []),
  }
}

function formKnowledge(d: AgentDetail) {
  return {
    knowledgeBases: d.knowledge?.bases ?? [],
    knowledgeTopK: d.knowledge?.top_k || 5,
    optimizeUserPrompt: d.optimize?.user_prompt ?? false,
  }
}

export function useAgentCatalog() {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [knowledgeBases, setKnowledgeBases] = useState<
    Array<{ id: string; name: string }>
  >([])

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

  return { providers, tools, knowledgeBases }
}

export function useAgentForm(agentId: string | null, copyFrom: string | null) {
  const [form, setForm] = useState<AgentFormData>(EMPTY_FORM)
  const [loading, setLoading] = useState(!!agentId)
  const [error, setError] = useState<string | null>(null)
  const isCreate = !agentId

  useEffect(() => {
    if (isCreate) return
    fetchAgentDetail(agentId!)
      .then((d) => setForm(agentDetailToForm(d)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [agentId, isCreate])

  useEffect(() => {
    if (!isCreate || !copyFrom) return
    fetchAgentDetail(copyFrom)
      .then((d) =>
        setForm({
          ...agentDetailToForm(d),
          id: "",
          name: `${d.name}-copy`,
        })
      )
      .catch((err) => setError(err.message))
  }, [isCreate, copyFrom])

  return { form, setForm, loading, error, setError, isCreate }
}

export async function persistAgentYaml(
  form: AgentFormData,
  isCreate: boolean,
  agentId: string | null
): Promise<string> {
  const yaml = formDataToYaml(form)
  const v = await validateAgent(yaml)
  if (!v.valid) {
    const err = new Error(v.message)
    err.name = "ValidateError"
    throw err
  }
  if (isCreate) {
    const created = await createAgent(yaml)
    return created.id
  }
  await updateAgent(agentId!, yaml)
  return agentId!
}

interface AgentSaveOpts {
  form: AgentFormData
  isCreate: boolean
  agentId: string | null
  onSaved?: (id: string) => void
  setError: (msg: string | null) => void
  setTab: (tab: string) => void
}

export function useAgentSave(opts: AgentSaveOpts) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const { form, isCreate, agentId, onSaved, setError, setTab } = opts

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
      const id = await persistAgentYaml(form, isCreate, agentId)
      onSaved?.(id)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ValidateError") {
        setError(t("agent.errValidate", { message: err.message }))
      } else {
        setError(err instanceof Error ? err.message : t("agent.errSave"))
      }
    } finally {
      setSaving(false)
    }
  }, [form, onSaved, t, isCreate, agentId, setError, setTab])

  return { saving, handleSave }
}
