import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { SettingsField } from "./settings-field"
import { SettingsSelect } from "./settings-select"
import type { GlobalFormState } from "./mcp-form-state"

type Patch = (partial: Partial<GlobalFormState>) => void

export function McpIdentityFields({
  form,
  locked,
  onChange,
}: {
  form: GlobalFormState
  locked: boolean
  onChange: Patch
}) {
  const { t } = useTranslation()
  const stdioLabel = t("agent.mcpTypeStdio")
  const sseLabel = t("agent.mcpTypeSse")
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SettingsField label={t("agent.mcpName")}>
        <Input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          disabled={locked}
          className="h-9 rounded-lg font-mono text-sm"
          placeholder="filesystem"
        />
      </SettingsField>
      <SettingsField label={t("agent.mcpType")}>
        <SettingsSelect
          value={form.type}
          options={[
            { value: "stdio", label: stdioLabel },
            { value: "sse", label: sseLabel },
          ]}
          onChange={(v) => onChange({ type: v as "stdio" | "sse" })}
        />
      </SettingsField>
    </div>
  )
}

export function McpStdioFields({
  form,
  onChange,
}: {
  form: GlobalFormState
  onChange: Patch
}) {
  const { t } = useTranslation()
  return (
    <>
      <SettingsField label={t("agent.mcpCommand")}>
        <Input
          value={form.command}
          onChange={(e) => onChange({ command: e.target.value })}
          className="h-9 rounded-lg font-mono text-sm"
          placeholder="npx"
        />
      </SettingsField>
      <SettingsField label={t("agent.mcpArgs")}>
        <Textarea
          value={form.args}
          onChange={(e) => onChange({ args: e.target.value })}
          placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/tmp"}
          className="min-h-20 resize-y rounded-lg font-mono text-xs leading-relaxed"
        />
      </SettingsField>
    </>
  )
}

export function McpSseField({
  url,
  onChange,
}: {
  url: string
  onChange: (url: string) => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsField label={t("agent.mcpUrl")}>
      <Input
        value={url}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg font-mono text-sm"
        placeholder="https://example.com/mcp/sse"
      />
    </SettingsField>
  )
}

export function McpEnvField({
  env,
  onChange,
}: {
  env: string
  onChange: (env: string) => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsField label={t("agent.mcpEnv")}>
      <Textarea
        value={env}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"NODE_ENV=production\nAPI_KEY=xxx"}
        className="min-h-16 resize-y rounded-lg font-mono text-xs leading-relaxed"
      />
    </SettingsField>
  )
}

export function McpFormActions({
  saving,
  canSave,
  onCancel,
  onSave,
}: {
  saving: boolean
  canSave: boolean
  onCancel: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  return (
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
        onClick={onSave}
        disabled={saving || !canSave}
      >
        {saving ? t("settings.loading") : t("common.save")}
      </Button>
    </div>
  )
}
