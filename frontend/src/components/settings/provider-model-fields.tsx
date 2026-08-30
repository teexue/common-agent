import { useTranslation } from "react-i18next"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import type { ModelInfo } from "@/types/agent"
import { SettingsField } from "./settings-field"
import { SettingsSelect } from "./settings-select"

function mergeModelIds(fetched: ModelInfo[], enabled: string[]): ModelInfo[] {
  const seen = new Set<string>()
  const out: ModelInfo[] = []
  for (const m of fetched) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    out.push(m)
  }
  for (const id of enabled) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id })
  }
  return out
}

function toggleModel(id: string, selected: string[]): string[] {
  return selected.includes(id)
    ? selected.filter((m) => m !== id)
    : [...selected, id]
}

function ModelCheckRow({
  id,
  checked,
  onToggle,
}: {
  id: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
        checked ? "bg-primary/10 text-foreground" : "hover:bg-muted/60"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border"
        )}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="font-mono text-xs">{id}</span>
    </button>
  )
}

function AvailableModelsList({
  models,
  enabled,
  fetching,
  onToggle,
}: {
  models: ModelInfo[]
  enabled: string[]
  fetching: boolean
  onToggle: (id: string) => void
}) {
  const { t } = useTranslation()
  if (fetching) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {t("settings.fetchModelsLoading")}
      </p>
    )
  }
  if (models.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {t("settings.fetchModelsEmpty")}
      </p>
    )
  }
  return (
    <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 p-1">
      {models.map((m) => (
        <ModelCheckRow
          key={m.id}
          id={m.id}
          checked={enabled.includes(m.id)}
          onToggle={() => onToggle(m.id)}
        />
      ))}
    </div>
  )
}

function FetchStatus({
  canFetch,
  fetchErr,
  showOpenAIHint,
}: {
  canFetch: boolean
  fetchErr: string | null
  showOpenAIHint: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      {!canFetch && (
        <p className="text-[11px] text-muted-foreground">
          {t("settings.fetchModelsNoKey")}
        </p>
      )}
      {fetchErr && (
        <p className="text-[11px] text-destructive">
          {t("settings.fetchModelsFailed")}: {fetchErr}
        </p>
      )}
      {showOpenAIHint && !fetchErr && (
        <p className="text-[11px] text-muted-foreground">
          {t("settings.fetchModelsViaOpenAI")}
        </p>
      )}
    </>
  )
}

export function ModelsPathField({
  modelsPath,
  onModelsPathChange,
}: {
  modelsPath: string
  onModelsPathChange: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsField
      label={t("settings.providerModelsPath")}
      hint={t("settings.providerModelsPathHint")}
    >
      <Input
        value={modelsPath}
        onChange={(e) => onModelsPathChange(e.target.value)}
        className="h-9 rounded-lg font-mono text-sm"
        placeholder="/v1/models"
      />
    </SettingsField>
  )
}

export function ModelFields({
  defaultModel,
  onDefaultModelChange,
  enabledModels,
  onEnabledModelsChange,
  models,
  fetching,
  fetchErr,
  showOpenAIHint,
  canFetch,
}: {
  defaultModel: string
  onDefaultModelChange: (v: string) => void
  enabledModels: string[]
  onEnabledModelsChange: (v: string[]) => void
  models: ModelInfo[] | null
  fetching: boolean
  fetchErr: string | null
  showOpenAIHint: boolean
  canFetch: boolean
}) {
  const { t } = useTranslation()
  const onToggle = (id: string) => {
    const next = toggleModel(id, enabledModels)
    onEnabledModelsChange(next)
    if (!next.includes(defaultModel)) onDefaultModelChange(next[0] ?? "")
  }
  return (
    <div className="grid gap-4">
      <SettingsField
        label={t("settings.providerEnabledModels")}
        hint={t("settings.providerEnabledModelsHint")}
      >
        <FetchStatus
          canFetch={canFetch}
          fetchErr={fetchErr}
          showOpenAIHint={showOpenAIHint}
        />
        {canFetch && (
          <AvailableModelsList
            models={mergeModelIds(models ?? [], enabledModels)}
            enabled={enabledModels}
            fetching={fetching}
            onToggle={onToggle}
          />
        )}
      </SettingsField>
      <SettingsField label={t("settings.providerDefaultModel")}>
        <SettingsSelect
          value={defaultModel}
          options={enabledModels.map((id) => ({ value: id, label: id }))}
          placeholder={t("settings.fetchModelsPick")}
          onChange={onDefaultModelChange}
        />
      </SettingsField>
    </div>
  )
}
