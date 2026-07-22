import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  CheckCircle,
  Plug,
  Plus,
  Search,
  ShieldQuestion,
  Trash2,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { emptyMcpServer, type AgentFormData, type McpServerFormItem } from "@/lib/agent-yaml"
import type { ProviderInfo, ToolInfo } from "@/types/agent"
import type { TFunction } from "i18next"

function Field({
  label, hint, children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] font-medium text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[10px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SectionCard({
  title, description, children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {description && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

type ToolPermission = "auto_approve" | "confirm" | "deny"

function getToolPermission(form: AgentFormData, tool: string): ToolPermission {
  if (form.autoApprove.includes(tool)) return "auto_approve"
  if (form.alwaysDeny.includes(tool)) return "deny"
  return "confirm"
}

function setToolPermission(form: AgentFormData, tool: string, perm: ToolPermission): AgentFormData {
  const autoApprove = form.autoApprove.filter((x) => x !== tool)
  const alwaysDeny = form.alwaysDeny.filter((x) => x !== tool)
  if (perm === "auto_approve") return { ...form, autoApprove: [...autoApprove, tool], alwaysDeny }
  if (perm === "deny") return { ...form, autoApprove, alwaysDeny: [...alwaysDeny, tool] }
  return { ...form, autoApprove, alwaysDeny }
}

function getPermConfig(t: TFunction) {
  return {
    auto_approve: { icon: CheckCircle, color: "text-success", bg: "bg-success/10", label: t("agent.permAuto") },
    confirm: { icon: ShieldQuestion, color: "text-warning", bg: "bg-warning/10", label: t("agent.permConfirm") },
    deny: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: t("agent.permDeny") },
  } as const
}

export function BasicTab({
  form, setForm, providers, isCreate,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
  providers: ProviderInfo[]
  isCreate: boolean
}) {
  const { t } = useTranslation()
  const currentProvider = providers.find((p) => p.name === form.provider)

  return (
    <div className="space-y-4">
      <SectionCard title={t("agent.sectionIdentity")} description={t("agent.sectionIdentityDesc")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("agent.name")} hint={t("agent.nameHint")}>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="my-agent"
              className="h-9 rounded-xl text-sm"
            />
          </Field>
          {!isCreate && form.id && (
            <Field label={t("agent.id")} hint={t("agent.idHint")}>
              <Input value={form.id} disabled className="h-9 rounded-xl font-mono text-sm text-muted-foreground" />
            </Field>
          )}
          <Field label={t("agent.provider")}>
            <Select
              value={form.provider ? { value: form.provider, label: form.provider } : null}
              onValueChange={(v) => {
                if (!v || typeof v !== "object" || !("value" in v)) return
                const name = (v as { value: string }).value
                const def = providers.find((p) => p.name === name)
                setForm((p) => ({ ...p, provider: name, model: def?.default_model || p.model }))
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-xl"><SelectValue placeholder={t("agent.selectProvider")} /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {providers.map((p) => (
                  <SelectItem key={p.name} value={{ value: p.name, label: `${p.display_name || p.name} (${p.api_style})` }}>
                    {p.display_name || p.name} <span className="text-muted-foreground">({p.api_style})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={t("agent.model")} hint={currentProvider ? t("agent.recommended", { model: currentProvider.default_model }) : undefined}>
          <Input
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            placeholder={currentProvider?.default_model || t("agent.modelName")}
            className="h-9 rounded-xl font-mono text-sm"
          />
        </Field>
      </SectionCard>

      <SectionCard title={t("agent.systemPrompt")} description={t("agent.systemPromptDesc")}>
        <Textarea
          value={form.systemPrompt}
          onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
          placeholder="You are a helpful assistant."
          className="min-h-40 rounded-xl font-mono text-sm leading-relaxed resize-y"
        />
      </SectionCard>
    </div>
  )
}

export function ToolsTab({
  form, setForm, tools,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
  tools: ToolInfo[]
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const permConfig = getPermConfig(t)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tools
    return tools.filter((tool) => tool.name.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q))
  }, [tools, query])

  const toggleTool = (name: string) => {
    setForm((prev) => {
      if (prev.tools.includes(name)) {
        return {
          ...prev,
          tools: prev.tools.filter((x) => x !== name),
          autoApprove: prev.autoApprove.filter((x) => x !== name),
          alwaysDeny: prev.alwaysDeny.filter((x) => x !== name),
        }
      }
      return { ...prev, tools: [...prev.tools, name] }
    })
  }

  return (
    <div className="space-y-4">
      <SectionCard title={t("agent.sectionTools")} description={t("agent.sectionToolsDesc")}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("agent.searchTools")}
              className="h-9 rounded-xl pl-8 text-sm"
            />
          </div>
          <Badge variant="secondary" className="rounded-md px-2 py-1 text-[10px]">
            {t("agent.selectedCount", { count: form.tools.length })}
          </Badge>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("agent.noToolsMatch")}</p>
        ) : (
          <div className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((tool) => {
              const selected = form.tools.includes(tool.name)
              const perm = getToolPermission(form, tool.name)
              return (
                <div
                  key={tool.name}
                  className={`rounded-xl border px-3 py-2.5 transition-colors ${selected ? "border-primary/30 bg-primary/5" : "border-border bg-background hover:bg-muted/40"}`}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleTool(tool.name)}
                      className="mt-1 h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-medium text-foreground">{tool.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{tool.description}</p>
                    </div>
                  </label>
                  {selected && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-border/60 pt-2 pl-6">
                      {(Object.keys(permConfig) as ToolPermission[]).map((p) => {
                        const c = permConfig[p]
                        const active = perm === p
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setForm((f) => setToolPermission(f, tool.name, p))}
                            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors ${
                              active ? `${c.bg} ${c.color} font-medium` : "text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <c.icon className="h-3 w-3" /> {c.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

export function RuntimeTab({
  form, setForm,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
}) {
  const { t } = useTranslation()
  const parallelLabel = t("common.parallel")
  const serialLabel = t("common.serial")

  return (
    <div className="space-y-4">
      <SectionCard title={t("agent.sectionRuntime")} description={t("agent.sectionRuntimeDesc")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("agent.maxTurns")} hint={t("agent.maxTurnsHint")}>
            <Input
              type="number"
              value={form.maxTurns}
              onChange={(e) => setForm((f) => ({ ...f, maxTurns: Number(e.target.value) }))}
              className="h-9 rounded-xl font-mono text-sm"
              min={1}
              max={100}
            />
          </Field>
          <Field label={t("agent.maxTokens")} hint={t("agent.maxTokensHint")}>
            <Input
              type="number"
              value={form.maxTokens}
              onChange={(e) => setForm((f) => ({ ...f, maxTokens: Number(e.target.value) }))}
              className="h-9 rounded-xl font-mono text-sm"
              min={256}
            />
          </Field>
          <Field label={t("agent.execMode")} hint={t("agent.execModeHint")}>
            <Select
              value={{ value: form.execMode, label: form.execMode === "parallel" ? parallelLabel : serialLabel }}
              onValueChange={(v) => {
                if (v && typeof v === "object" && "value" in v) {
                  setForm((f) => ({ ...f, execMode: (v as { value: string }).value as "parallel" | "serial" }))
                }
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value={{ value: "parallel", label: parallelLabel }}>{parallelLabel}</SelectItem>
                <SelectItem value={{ value: "serial", label: serialLabel }}>{serialLabel}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("agent.maxParallel")} hint={t("agent.maxParallelHint")}>
            <Input
              type="number"
              value={form.maxParallel}
              onChange={(e) => setForm((f) => ({ ...f, maxParallel: Number(e.target.value) }))}
              className="h-9 rounded-xl font-mono text-sm"
              min={1}
              max={16}
              disabled={form.execMode === "serial"}
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  )
}

export function McpTab({
  form,
  setForm,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
}) {
  const { t } = useTranslation()
  const servers = form.mcpServers

  const addServer = () => {
    setForm((f) => ({ ...f, mcpServers: [...f.mcpServers, emptyMcpServer()] }))
  }

  const updateServer = (idx: number, patch: Partial<McpServerFormItem>) => {
    setForm((f) => ({
      ...f,
      mcpServers: f.mcpServers.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }))
  }

  const removeServer = (idx: number) => {
    setForm((f) => ({ ...f, mcpServers: f.mcpServers.filter((_, i) => i !== idx) }))
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title={t("agent.sectionMcp")}
        description={t("agent.sectionMcpDesc")}
      >
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="rounded-md px-2 py-1 text-[10px]">
            {t("agent.mcpCount", { count: servers.length })}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-xl text-xs"
            onClick={addServer}
          >
            <Plus className="h-3.5 w-3.5" /> {t("agent.mcpAdd")}
          </Button>
        </div>

        {servers.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{t("agent.mcpEmpty")}</p>
        ) : (
          <div className="space-y-3">
            {servers.map((srv, idx) => (
              <McpServerRow
                key={idx}
                server={srv}
                onChange={(patch) => updateServer(idx, patch)}
                onRemove={() => removeServer(idx)}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function McpServerRow({
  server,
  onChange,
  onRemove,
}: {
  server: McpServerFormItem
  onChange: (patch: Partial<McpServerFormItem>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const stdioLabel = t("agent.mcpTypeStdio")
  const sseLabel = t("agent.mcpTypeSse")

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            {server.name || t("agent.mcpUntitled")}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("agent.mcpName")} hint={t("agent.mcpNameHint")}>
          <Input
            value={server.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="filesystem"
            className="h-9 rounded-xl font-mono text-sm"
          />
        </Field>
        <Field label={t("agent.mcpType")}>
          <Select
            value={{ value: server.type, label: server.type === "stdio" ? stdioLabel : sseLabel }}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) {
                onChange({ type: (v as { value: string }).value as "stdio" | "sse" })
              }
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value={{ value: "stdio", label: stdioLabel }}>{stdioLabel}</SelectItem>
              <SelectItem value={{ value: "sse", label: sseLabel }}>{sseLabel}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {server.type === "stdio" ? (
        <>
          <Field label={t("agent.mcpCommand")} hint={t("agent.mcpCommandHint")}>
            <Input
              value={server.command}
              onChange={(e) => onChange({ command: e.target.value })}
              placeholder="npx"
              className="mt-1 h-9 rounded-xl font-mono text-sm"
            />
          </Field>
          <Field label={t("agent.mcpArgs")} hint={t("agent.mcpArgsHint")}>
            <Textarea
              value={server.args}
              onChange={(e) => onChange({ args: e.target.value })}
              placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/tmp"}
              className="mt-1 min-h-20 rounded-xl font-mono text-xs leading-relaxed resize-y"
            />
          </Field>
        </>
      ) : (
        <Field label={t("agent.mcpUrl")} hint={t("agent.mcpUrlHint")}>
          <Input
            value={server.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://example.com/mcp/sse"
            className="mt-1 h-9 rounded-xl font-mono text-sm"
          />
        </Field>
      )}

      <Field label={t("agent.mcpEnv")} hint={t("agent.mcpEnvHint")}>
        <Textarea
          value={server.env}
          onChange={(e) => onChange({ env: e.target.value })}
          placeholder={"NODE_ENV=production\nAPI_KEY=xxx"}
          className="mt-1 min-h-16 rounded-xl font-mono text-xs leading-relaxed resize-y"
        />
      </Field>
    </div>
  )
}

