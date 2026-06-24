import { useCallback, useEffect, useState } from "react"
import { FileCode, Loader2, Plus, Save, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  fetchAgentDetail,
  fetchProviders,
  fetchTools,
  updateAgent,
} from "@/lib/api"
import { validateAgent } from "@/lib/api"
import type { ProviderInfo } from "@/types/agent"

interface AgentEditorProps {
  agentName: string | null // null = create new
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

interface AgentFormData {
  name: string
  provider: string
  model: string
  systemPrompt: string
  tools: string[]
  maxTurns: number
  maxTokens: number
  execMode: "parallel" | "serial"
  maxParallel: number
  autoApprove: string[]
  alwaysDeny: string[]
}

const EMPTY_FORM: AgentFormData = {
  name: "",
  provider: "",
  model: "",
  systemPrompt: "You are a helpful assistant.",
  tools: [],
  maxTurns: 10,
  maxTokens: 4096,
  execMode: "parallel",
  maxParallel: 4,
  autoApprove: [],
  alwaysDeny: [],
}

export function AgentEditor({
  agentName,
  open,
  onOpenChange,
  onSaved,
}: AgentEditorProps) {
  const [form, setForm] = useState<AgentFormData>(EMPTY_FORM)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [availableTools, setAvailableTools] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTool, setNewTool] = useState("")

  const isCreate = agentName === null

  // Load providers and tools on open
  useEffect(() => {
    if (!open) return
    fetchProviders()
      .then(setProviders)
      .catch(() => setProviders([]))
    fetchTools()
      .then((tools) => setAvailableTools(tools.map((t) => t.name)))
      .catch(() => setAvailableTools([]))
  }, [open])

  // Load existing agent data when editing
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM)
      setError(null)
      return
    }

    if (isCreate) {
      setForm(EMPTY_FORM)
      setError(null)
      return
    }

    setLoading(true)
    fetchAgentDetail(agentName!)
      .then((detail) => {
        setForm({
          name: detail.name,
          provider: detail.provider,
          model: detail.model,
          systemPrompt: detail.system_prompt || "",
          tools: detail.tools || [],
          maxTurns: detail.max_turns || 10,
          maxTokens: detail.max_tokens || 4096,
          execMode: (detail.tool_execution?.Mode as "parallel" | "serial") || "parallel",
          maxParallel: detail.tool_execution?.MaxParallel || 4,
          autoApprove: detail.permissions?.auto_approve || [],
          alwaysDeny: detail.permissions?.always_deny || [],
        })
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [open, agentName, isCreate])

  // When provider changes, set default model
  const handleProviderChange = useCallback(
    (providerName: string | null) => {
      if (!providerName) return
      setForm((prev) => {
        const prov = providers.find((p) => p.name === providerName)
        return {
          ...prev,
          provider: providerName,
          model: prov?.default_model || prev.model,
        }
      })
    },
    [providers]
  )

  // Get models hint for current provider
  const currentProvider = providers.find((p) => p.name === form.provider)

  // Tool management
  const addTool = useCallback(() => {
    const tool = newTool.trim()
    if (tool && !form.tools.includes(tool)) {
      setForm((prev) => ({ ...prev, tools: [...prev.tools, tool] }))
      setNewTool("")
    }
  }, [newTool, form.tools])

  const removeTool = useCallback((tool: string) => {
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.filter((t) => t !== tool),
    }))
  }, [])

  const handleSave = useCallback(async () => {
    setError(null)

    if (!form.name.trim()) {
      setError("请填写 Agent 名称")
      return
    }
    if (!form.provider) {
      setError("请选择 Provider")
      return
    }
    if (!form.model.trim()) {
      setError("请填写模型名称")
      return
    }

    setSaving(true)
    try {
      // Build YAML from form data
      const lines: string[] = [
        `name: ${form.name}`,
        `version: 1`,
        `provider: ${form.provider}`,
        `model: ${form.model}`,
      ]

      if (form.systemPrompt) {
        lines.push(`system_prompt: |`)
        for (const line of form.systemPrompt.split("\n")) {
          lines.push(`  ${line}`)
        }
      }

      lines.push(`tools:`)
      for (const t of form.tools) {
        lines.push(`  - ${t}`)
      }

      lines.push(`max_turns: ${form.maxTurns}`)
      if (form.maxTokens) {
        lines.push(`max_tokens: ${form.maxTokens}`)
      }

      lines.push(`tool_execution:`)
      lines.push(`  mode: ${form.execMode}`)
      lines.push(`  max_parallel: ${form.maxParallel}`)

      if (form.autoApprove.length > 0 || form.alwaysDeny.length > 0) {
        lines.push(`permissions:`)
        if (form.autoApprove.length > 0) {
          lines.push(`  auto_approve:`)
          for (const t of form.autoApprove) {
            lines.push(`    - ${t}`)
          }
        }
        if (form.alwaysDeny.length > 0) {
          lines.push(`  always_deny:`)
          for (const t of form.alwaysDeny) {
            lines.push(`    - ${t}`)
          }
        }
      }

      const yaml = lines.join("\n") + "\n"

      // Validate before saving
      const validation = await validateAgent(yaml)
      if (!validation.valid) {
        setError(`校验失败: ${validation.message}`)
        setSaving(false)
        return
      }

      await updateAgent(form.name, yaml)
      onSaved?.()
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }, [form, onSaved, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-sm tracking-tight">
            <FileCode className="h-4 w-4 text-primary" />
            {isCreate ? "创建 Agent" : `编辑 ${agentName}`}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (
          <div className="flex flex-col gap-4">
            {/* Name */}
            <Field label="名称">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="my-agent"
                disabled={!isCreate}
                className="rounded-xl font-mono text-xs"
              />
            </Field>

            {/* Provider */}
            <Field label="Provider">
              <Select
                value={form.provider ? { value: form.provider, label: providers.find(p => p.name === form.provider)?.name ?? form.provider } : null}
                onValueChange={(v) => {
                  if (v && typeof v === "object" && "value" in v) {
                    handleProviderChange((v as {value: string}).value)
                  }
                }}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="选择 Provider" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {providers.map((p) => (
                    <SelectItem key={p.name} value={{ value: p.name, label: `${p.name} (${p.type})` }}>
                      {p.name} ({p.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Model */}
            <Field label="模型">
              <Input
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder={currentProvider?.default_model || "模型名称"}
                className="rounded-xl font-mono text-xs"
              />
              {currentProvider && (
                <p className="text-[10px] text-muted-foreground">
                  推荐: {currentProvider.default_model}
                </p>
              )}
            </Field>

            {/* System Prompt */}
            <Field label="系统提示词">
              <Textarea
                value={form.systemPrompt}
                onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                placeholder="You are a helpful assistant."
                className="h-24 rounded-xl font-mono text-xs resize-none"
              />
            </Field>

            <Separator />

            {/* Tools */}
            <Field label={`工具 (${form.tools.length})`}>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.tools.map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="rounded-md px-2 py-0.5 font-mono text-[10px] gap-1"
                  >
                    {t}
                    <button onClick={() => removeTool(t)} className="hover:text-destructive">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
                {form.tools.length === 0 && (
                  <span className="text-[10px] text-muted-foreground">未选择工具</span>
                )}
              </div>
              <div className="flex gap-1.5">
                <Select
                  value={newTool ? { value: newTool, label: newTool } : null}
                  onValueChange={(v) => {
                    if (v && typeof v === "object" && "value" in v) {
                      setNewTool((v as {value: string}).value)
                    }
                  }}
                >
                  <SelectTrigger className="w-full rounded-xl flex-1">
                    <SelectValue placeholder="添加工具..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-48 overflow-y-auto">
                    {availableTools
                      .filter((t) => !form.tools.includes(t))
                      .map((t) => (
                        <SelectItem key={t} value={{ value: t, label: t }}>
                          {t}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={addTool}
                  disabled={!newTool}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Field>

            <Separator />

            {/* Execution config */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="最大轮次">
                <Input
                  type="number"
                  value={form.maxTurns}
                  onChange={(e) => setForm((f) => ({ ...f, maxTurns: Number(e.target.value) }))}
                  className="rounded-xl font-mono text-xs"
                  min={1}
                  max={100}
                />
              </Field>
              <Field label="最大 Tokens">
                <Input
                  type="number"
                  value={form.maxTokens}
                  onChange={(e) => setForm((f) => ({ ...f, maxTokens: Number(e.target.value) }))}
                  className="rounded-xl font-mono text-xs"
                  min={256}
                />
              </Field>
              <Field label="执行模式">
                <Select
                  value={{ value: form.execMode, label: form.execMode === "parallel" ? "并行" : "串行" }}
                  onValueChange={(v) => {
                    if (v && typeof v === "object" && "value" in v) {
                      setForm((f) => ({ ...f, execMode: (v as {value: string}).value as "parallel" | "serial" }))
                    }
                  }}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={{ value: "parallel", label: "并行" }}>并行</SelectItem>
                    <SelectItem value={{ value: "serial", label: "串行" }}>串行</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="最大并行数">
                <Input
                  type="number"
                  value={form.maxParallel}
                  onChange={(e) => setForm((f) => ({ ...f, maxParallel: Number(e.target.value) }))}
                  className="rounded-xl font-mono text-xs"
                  min={1}
                  max={16}
                  disabled={form.execMode === "serial"}
                />
              </Field>
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg text-xs"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-lg text-xs"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Field helper ─────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
