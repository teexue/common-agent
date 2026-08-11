import { useTranslation } from "react-i18next"
import { Plug, Plus, Trash2 } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  emptyMcpServer,
  type AgentFormData,
  type McpServerFormItem,
} from "@/lib/agent-yaml"
import { Field, SectionCard } from "./shared"

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
      mcpServers: f.mcpServers.map((s, i) =>
        i === idx ? { ...s, ...patch } : s
      ),
    }))
  }

  const removeServer = (idx: number) => {
    setForm((f) => ({
      ...f,
      mcpServers: f.mcpServers.filter((_, i) => i !== idx),
    }))
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title={t("agent.sectionMcp")}
        description={t("agent.sectionMcpDesc")}
      >
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className="rounded-md px-2 py-1 text-[10px]"
          >
            {t("agent.mcpCount", { count: servers.length })}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={addServer}
          >
            <Plus className="h-3.5 w-3.5" /> {t("agent.mcpAdd")}
          </Button>
        </div>

        {servers.length === 0 ? (
          <EmptyState title={t("agent.mcpEmpty")} />
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
            value={{
              value: server.type,
              label: server.type === "stdio" ? stdioLabel : sseLabel,
            }}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) {
                onChange({
                  type: (v as { value: string }).value as "stdio" | "sse",
                })
              }
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value={{ value: "stdio", label: stdioLabel }}>
                {stdioLabel}
              </SelectItem>
              <SelectItem value={{ value: "sse", label: sseLabel }}>
                {sseLabel}
              </SelectItem>
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
              className="mt-1 min-h-20 resize-y rounded-xl font-mono text-xs leading-relaxed"
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
          className="mt-1 min-h-16 resize-y rounded-xl font-mono text-xs leading-relaxed"
        />
      </Field>
    </div>
  )
}
