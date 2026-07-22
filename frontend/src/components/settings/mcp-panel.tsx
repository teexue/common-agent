import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Globe, Plug, Plus, Trash2 } from "lucide-react"
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
import { deleteGlobalMCP, fetchMCPServers, upsertGlobalMCP } from "@/lib/api"
import type { MCPServerInfo } from "@/types/agent"

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-6">
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

interface GlobalFormState {
  name: string
  type: "stdio" | "sse"
  command: string
  args: string
  env: string
  url: string
}

function emptyForm(): GlobalFormState {
  return { name: "", type: "stdio", command: "", args: "", env: "", url: "" }
}

function parseLines(s: string): string[] {
  return s.split("\n").map((l) => l.trim()).filter((l) => l.length > 0)
}

function parseEnv(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of parseLines(s)) {
    const idx = line.indexOf("=")
    if (idx <= 0) continue
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return out
}

function GlobalMCPForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: GlobalFormState
  onSaved: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<GlobalFormState>(initial ?? emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stdioLabel = t("agent.mcpTypeStdio")
  const sseLabel = t("agent.mcpTypeSse")

  const canSave = form.name.trim() !== "" && (form.type === "sse" ? form.url.trim() !== "" : form.command.trim() !== "")

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload: Parameters<typeof upsertGlobalMCP>[0] = {
        name: form.name.trim(),
        type: form.type,
      }
      if (form.type === "stdio") {
        const cmd = form.command.trim()
        if (cmd) payload.command = cmd
        const args = parseLines(form.args)
        if (args.length > 0) payload.args = args
      } else {
        const url = form.url.trim()
        if (url) payload.url = url
      }
      const env = parseEnv(form.env)
      if (Object.keys(env).length > 0) payload.env = env
      await upsertGlobalMCP(payload)
      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("agent.mcpName")}</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            disabled={!!initial}
            className="h-9 rounded-lg font-mono text-sm"
            placeholder="filesystem"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("agent.mcpType")}</Label>
          <Select
            value={{ value: form.type, label: form.type === "stdio" ? stdioLabel : sseLabel }}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) {
                setForm((f) => ({ ...f, type: (v as { value: string }).value as "stdio" | "sse" }))
              }
            }}
          >
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value={{ value: "stdio", label: stdioLabel }}>{stdioLabel}</SelectItem>
              <SelectItem value={{ value: "sse", label: sseLabel }}>{sseLabel}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.type === "stdio" ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("agent.mcpCommand")}</Label>
            <Input
              value={form.command}
              onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
              className="h-9 rounded-lg font-mono text-sm"
              placeholder="npx"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("agent.mcpArgs")}</Label>
            <Textarea
              value={form.args}
              onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
              placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/tmp"}
              className="min-h-20 rounded-lg font-mono text-xs leading-relaxed resize-y"
            />
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("agent.mcpUrl")}</Label>
          <Input
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            className="h-9 rounded-lg font-mono text-sm"
            placeholder="https://example.com/mcp/sse"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("agent.mcpEnv")}</Label>
        <Textarea
          value={form.env}
          onChange={(e) => setForm((f) => ({ ...f, env: e.target.value }))}
          placeholder={"NODE_ENV=production\nAPI_KEY=xxx"}
          className="min-h-16 rounded-lg font-mono text-xs leading-relaxed resize-y"
        />
      </div>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-8 rounded-lg px-4 text-xs" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button size="sm" className="h-8 gap-1.5 rounded-lg px-4 text-xs" onClick={handleSave} disabled={saving || !canSave}>
          {saving ? t("settings.loading") : t("common.save")}
        </Button>
      </div>
    </div>
  )
}

function GlobalMCPCard({
  server,
  onEdit,
  onDelete,
}: {
  server: MCPServerInfo
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/20 hover:bg-muted/30">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Globe className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{server.name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 text-[10px] font-mono">{server.type}</Badge>
          {server.command && <span className="truncate font-mono text-[11px] text-muted-foreground">{server.command}</span>}
          {server.url && <span className="truncate font-mono text-[11px] text-muted-foreground">{server.url}</span>}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon-xs" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={onEdit}>
          <Plug className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-xs" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function AgentMCPCard({ server }: { server: MCPServerInfo }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Plug className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{server.name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px] font-mono">{server.type}</Badge>
          {server.command && <span className="truncate font-mono text-[11px] text-muted-foreground">{server.command}</span>}
          {server.url && <span className="truncate font-mono text-[11px] text-muted-foreground">{server.url}</span>}
        </div>
      </div>
      <Badge variant="secondary" className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px]">{server.agent}</Badge>
    </div>
  )
}

/** MCP management panel for Settings: editable global servers + read-only per-agent. */
export function McpPanel() {
  const { t } = useTranslation()
  const [servers, setServers] = useState<MCPServerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    setError(null)
    fetchMCPServers()
      .then((list) => setServers(list ?? []))
      .catch((e: unknown) => {
        setServers([])
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [])

  if (loading) return <EmptyState text={t("settings.mcpLoading")} />

  const globalServers = servers.filter((s) => s.scope === "global")
  const agentServers = servers.filter((s) => s.scope === "agent")

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("settings.mcpGlobal")}
            </span>
            <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">{globalServers.length}</Badge>
          </div>
          {editing === null && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={() => setEditing("")}>
              <Plus className="h-3.5 w-3.5" /> {t("agent.mcpAdd")}
            </Button>
          )}
        </div>

        {globalServers.length === 0 && editing === null && (
          <EmptyState text={t("settings.mcpGlobalEmpty")} />
        )}

        {globalServers.map((s) => (
          editing === s.name
            ? <GlobalMCPForm key={s.name} initial={{
                name: s.name,
                type: s.type === "sse" ? "sse" : "stdio",
                command: s.command ?? "",
                args: "",
                env: "",
                url: s.url ?? "",
              }} onSaved={() => { setEditing(null); refresh() }} onCancel={() => setEditing(null)} />
            : (
              <GlobalMCPCard
                key={s.name}
                server={s}
                onEdit={() => setEditing(s.name)}
                onDelete={async () => { await deleteGlobalMCP(s.name); refresh() }}
              />
            )
        ))}
        {editing === "" && <GlobalMCPForm onSaved={() => { setEditing(null); refresh() }} onCancel={() => setEditing(null)} />}
      </div>

      {agentServers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Plug className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("settings.mcpPerAgent")}
            </span>
            <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">{agentServers.length}</Badge>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">{t("settings.mcpPerAgentHint")}</p>
          {agentServers.map((s) => <AgentMCPCard key={`${s.agent}-${s.name}`} server={s} />)}
        </div>
      )}
    </div>
  )
}
