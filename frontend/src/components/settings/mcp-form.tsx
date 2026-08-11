import { useState } from "react"
import { useTranslation } from "react-i18next"
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
import { upsertGlobalMCP } from "@/lib/api"

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
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
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

export function GlobalMCPForm({
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

  const canSave =
    form.name.trim() !== "" &&
    (form.type === "sse" ? form.url.trim() !== "" : form.command.trim() !== "")

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
          <Label className="text-xs text-muted-foreground">
            {t("agent.mcpName")}
          </Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            disabled={!!initial}
            className="h-9 rounded-lg font-mono text-sm"
            placeholder="filesystem"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("agent.mcpType")}
          </Label>
          <Select
            value={{
              value: form.type,
              label: form.type === "stdio" ? stdioLabel : sseLabel,
            }}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) {
                setForm((f) => ({
                  ...f,
                  type: (v as { value: string }).value as "stdio" | "sse",
                }))
              }
            }}
          >
            <SelectTrigger className="h-9 rounded-lg text-sm">
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
        </div>
      </div>

      {form.type === "stdio" ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("agent.mcpCommand")}
            </Label>
            <Input
              value={form.command}
              onChange={(e) =>
                setForm((f) => ({ ...f, command: e.target.value }))
              }
              className="h-9 rounded-lg font-mono text-sm"
              placeholder="npx"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("agent.mcpArgs")}
            </Label>
            <Textarea
              value={form.args}
              onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
              placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/tmp"}
              className="min-h-20 resize-y rounded-lg font-mono text-xs leading-relaxed"
            />
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("agent.mcpUrl")}
          </Label>
          <Input
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            className="h-9 rounded-lg font-mono text-sm"
            placeholder="https://example.com/mcp/sse"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("agent.mcpEnv")}
        </Label>
        <Textarea
          value={form.env}
          onChange={(e) => setForm((f) => ({ ...f, env: e.target.value }))}
          placeholder={"NODE_ENV=production\nAPI_KEY=xxx"}
          className="min-h-16 resize-y rounded-lg font-mono text-xs leading-relaxed"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-4 text-xs"
          onClick={onCancel}
        >
          {t("common.cancel")}
        </Button>
        <Button
          size="sm"
          className="h-8 gap-1.5 px-4 text-xs"
          onClick={handleSave}
          disabled={saving || !canSave}
        >
          {saving ? t("settings.loading") : t("common.save")}
        </Button>
      </div>
    </div>
  )
}
