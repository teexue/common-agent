import { useCallback, useEffect, useState } from "react"
import { CheckCircle, FileCode, Loader2, Plus, Save, ShieldQuestion, X, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { fetchAgentDetail, fetchProviders, fetchTools, updateAgent, validateAgent } from "@/lib/api"
import { formDataToYaml, EMPTY_FORM } from "@/lib/agent-yaml"
import type { AgentFormData } from "@/lib/agent-yaml"
import type { ProviderInfo } from "@/types/agent"

interface AgentEditorProps {
  agentName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</Label>{children}</div>
}

function ToolsSection({ form, setForm, availableTools }: { form: AgentFormData; setForm: (fn: (p: AgentFormData) => AgentFormData) => void; availableTools: string[] }) {
  const [newTool, setNewTool] = useState("")
  const addTool = useCallback(() => { const t = newTool.trim(); if (t && !form.tools.includes(t)) { setForm((p) => ({ ...p, tools: [...p.tools, t] })); setNewTool("") } }, [newTool, form.tools, setForm])
  const removeTool = useCallback((tool: string) => { setForm((p) => ({ ...p, tools: p.tools.filter((t) => t !== tool) })) }, [setForm])

  return (
    <Field label={`工具 (${form.tools.length})`}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {form.tools.map((t) => <Badge key={t} variant="secondary" className="rounded-md px-2 py-0.5 font-mono text-[10px] gap-1">{t}<button onClick={() => removeTool(t)} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button></Badge>)}
        {form.tools.length === 0 && <span className="text-[10px] text-muted-foreground">未选择工具</span>}
      </div>
      <div className="flex gap-1.5">
        <Select value={newTool ? { value: newTool, label: newTool } : null} onValueChange={(v) => { if (v && typeof v === "object" && "value" in v) setNewTool((v as { value: string }).value) }}>
          <SelectTrigger className="w-full rounded-xl flex-1"><SelectValue placeholder="添加工具..." /></SelectTrigger>
          <SelectContent className="rounded-xl max-h-48 overflow-y-auto">{availableTools.filter((t) => !form.tools.includes(t)).map((t) => <SelectItem key={t} value={{ value: t, label: t }}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={addTool} disabled={!newTool}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
    </Field>
  )
}

function ExecConfigSection({ form, setForm }: { form: AgentFormData; setForm: (fn: (p: AgentFormData) => AgentFormData) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="最大轮次"><Input type="number" value={form.maxTurns} onChange={(e) => setForm((f) => ({ ...f, maxTurns: Number(e.target.value) }))} className="rounded-xl font-mono text-xs" min={1} max={100} /></Field>
      <Field label="最大 Tokens"><Input type="number" value={form.maxTokens} onChange={(e) => setForm((f) => ({ ...f, maxTokens: Number(e.target.value) }))} className="rounded-xl font-mono text-xs" min={256} /></Field>
      <Field label="执行模式">
        <Select value={{ value: form.execMode, label: form.execMode === "parallel" ? "并行" : "串行" }} onValueChange={(v) => { if (v && typeof v === "object" && "value" in v) setForm((f) => ({ ...f, execMode: (v as { value: string }).value as "parallel" | "serial" })) }}>
          <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl"><SelectItem value={{ value: "parallel", label: "并行" }}>并行</SelectItem><SelectItem value={{ value: "serial", label: "串行" }}>串行</SelectItem></SelectContent>
        </Select>
      </Field>
      <Field label="最大并行数"><Input type="number" value={form.maxParallel} onChange={(e) => setForm((f) => ({ ...f, maxParallel: Number(e.target.value) }))} className="rounded-xl font-mono text-xs" min={1} max={16} disabled={form.execMode === "serial"} /></Field>
    </div>
  )
}

function BasicFields({ form, setForm, providers, isCreate }: { form: AgentFormData; setForm: (fn: (p: AgentFormData) => AgentFormData) => void; providers: ProviderInfo[]; isCreate: boolean }) {
  const handleProviderChange = useCallback((name: string | null) => { if (!name) return; setForm((p) => ({ ...p, provider: name, model: providers.find((x) => x.name === name)?.default_model || p.model })) }, [providers, setForm])
  const currentProvider = providers.find((p) => p.name === form.provider)
  return (
    <>
      <Field label="名称"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="my-agent" disabled={!isCreate} className="rounded-xl font-mono text-xs" /></Field>
      <Field label="Provider">
        <Select value={form.provider ? { value: form.provider, label: providers.find(p => p.name === form.provider)?.name ?? form.provider } : null} onValueChange={(v) => { if (v && typeof v === "object" && "value" in v) handleProviderChange((v as { value: string }).value) }}>
          <SelectTrigger className="w-full rounded-xl"><SelectValue placeholder="选择 Provider" /></SelectTrigger>
          <SelectContent className="rounded-xl">{providers.map((p) => <SelectItem key={p.name} value={{ value: p.name, label: `${p.name} (${p.type})` }}>{p.name} ({p.type})</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="模型"><Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder={currentProvider?.default_model || "模型名称"} className="rounded-xl font-mono text-xs" />{currentProvider && <p className="text-[10px] text-muted-foreground">推荐: {currentProvider.default_model}</p>}</Field>
      <Field label="系统提示词"><Textarea value={form.systemPrompt} onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))} placeholder="You are a helpful assistant." className="h-24 rounded-xl font-mono text-xs resize-none" /></Field>
    </>
  )
}

type ToolPermission = "auto_approve" | "confirm" | "deny"

function getToolPermission(form: AgentFormData, tool: string): ToolPermission {
  if (form.autoApprove.includes(tool)) return "auto_approve"
  if (form.alwaysDeny.includes(tool)) return "deny"
  return "confirm"
}

function setToolPermission(form: AgentFormData, tool: string, perm: ToolPermission): AgentFormData {
  const autoApprove = form.autoApprove.filter((t) => t !== tool)
  const alwaysDeny = form.alwaysDeny.filter((t) => t !== tool)
  if (perm === "auto_approve") return { ...form, autoApprove: [...autoApprove, tool], alwaysDeny }
  if (perm === "deny") return { ...form, autoApprove, alwaysDeny: [...alwaysDeny, tool] }
  return { ...form, autoApprove, alwaysDeny }
}

const PERM_CONFIG: Record<ToolPermission, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  auto_approve: { icon: CheckCircle, color: "text-success", bg: "bg-success/10", label: "自动批准" },
  confirm: { icon: ShieldQuestion, color: "text-warning", bg: "bg-warning/10", label: "需审批" },
  deny: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "禁止" },
}

function PermissionsSection({ form, setForm }: { form: AgentFormData; setForm: (fn: (p: AgentFormData) => AgentFormData) => void }) {
  if (form.tools.length === 0) return null

  const autoCount = form.tools.filter((t) => getToolPermission(form, t) === "auto_approve").length
  const denyCount = form.tools.filter((t) => getToolPermission(form, t) === "deny").length

  return (
    <Field label={`权限策略 (${autoCount} 自动 / ${form.tools.length - autoCount - denyCount} 审批 / ${denyCount} 禁止)`}>
      <div className="flex flex-col gap-1">
        {form.tools.map((tool) => {
          const perm = getToolPermission(form, tool)
          return (
            <div key={tool} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
              <span className="flex-1 truncate font-mono text-xs">{tool}</span>
              <div className="flex gap-0.5">
                {(Object.keys(PERM_CONFIG) as ToolPermission[]).map((p) => {
                  const c = PERM_CONFIG[p]
                  const active = perm === p
                  return (
                    <button
                      key={p}
                      onClick={() => setForm((f) => setToolPermission(f, tool, p))}
                      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${
                        active ? `${c.bg} ${c.color} font-medium` : "text-muted-foreground hover:bg-muted"
                      }`}
                      title={c.label}
                    >
                      <c.icon className="h-3 w-3" />
                      {c.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Field>
  )
}

export function AgentEditor({ agentName, open, onOpenChange, onSaved }: AgentEditorProps) {
  const [form, setForm] = useState<AgentFormData>(EMPTY_FORM)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [availableTools, setAvailableTools] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isCreate = agentName === null

  useEffect(() => { if (!open) return; fetchProviders().then(setProviders).catch(() => setProviders([])); fetchTools().then((t) => setAvailableTools(t.map((x) => x.name))).catch(() => setAvailableTools([])) }, [open])

  useEffect(() => {
    if (!open) { setForm(EMPTY_FORM); setError(null); return }
    if (isCreate) { setForm(EMPTY_FORM); setError(null); return }
    setLoading(true)
    fetchAgentDetail(agentName!).then((d) => setForm({ name: d.name, provider: d.provider, model: d.model, systemPrompt: d.system_prompt || "", tools: d.tools || [], maxTurns: d.max_turns || 10, maxTokens: d.max_tokens || 4096, execMode: (d.tool_execution?.Mode as "parallel" | "serial") || "parallel", maxParallel: d.tool_execution?.MaxParallel || 4, autoApprove: d.permissions?.auto_approve || [], alwaysDeny: d.permissions?.always_deny || [] })).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }, [open, agentName, isCreate])

  const handleSave = useCallback(async () => {
    setError(null)
    if (!form.name.trim()) { setError("请填写 Agent 名称"); return }
    if (!form.provider) { setError("请选择 Provider"); return }
    if (!form.model.trim()) { setError("请填写模型名称"); return }
    setSaving(true)
    try { const yaml = formDataToYaml(form); const v = await validateAgent(yaml); if (!v.valid) { setError(`校验失败: ${v.message}`); setSaving(false); return }; await updateAgent(form.name, yaml); onSaved?.(); onOpenChange(false) } catch (err: unknown) { setError(err instanceof Error ? err.message : "保存失败") } finally { setSaving(false) }
  }, [form, onSaved, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto border-border bg-card">
        <DialogHeader><DialogTitle className="flex items-center gap-2 font-heading text-sm tracking-tight"><FileCode className="h-4 w-4 text-primary" /> {isCreate ? "创建 Agent" : `编辑 ${agentName}`}</DialogTitle></DialogHeader>
        {loading && <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {!loading && (
          <div className="flex flex-col gap-4">
            <BasicFields form={form} setForm={setForm} providers={providers} isCreate={isCreate} />
            <Separator /><ToolsSection form={form} setForm={setForm} availableTools={availableTools} /><Separator /><PermissionsSection form={form} setForm={setForm} /><Separator /><ExecConfigSection form={form} setForm={setForm} />
            {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">{error}</div>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => onOpenChange(false)}>取消</Button>
          <Button size="sm" className="gap-1.5 rounded-lg text-xs" onClick={handleSave} disabled={saving || loading}>{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} 保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
