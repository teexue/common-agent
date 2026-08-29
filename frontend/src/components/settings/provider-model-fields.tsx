import { useTranslation } from "react-i18next"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ModelInfo } from "@/types/agent"
import { SettingsField } from "./settings-field"
import { SettingsSelect } from "./settings-select"
import { defaultModelsPath, type StyleOption } from "./provider-form-utils"

function fetchTitle(
  t: (key: string) => string,
  canFetch: boolean,
  apiKeyOptional?: boolean
): string {
  if (!canFetch) return t("settings.fetchModelsNoKey")
  if (apiKeyOptional) return t("settings.fetchModelsLocalHint")
  return t("settings.fetchModelsHint")
}

function FetchedModelSelect({
  defaultModel,
  models,
  onChange,
}: {
  defaultModel: string
  models: ModelInfo[]
  onChange: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsSelect
      value={defaultModel}
      options={models.map((m) => ({ value: m.id, label: m.id }))}
      placeholder={t("settings.fetchModelsPick")}
      onChange={onChange}
    />
  )
}

function FetchModelsButton({
  fetching,
  canFetch,
  apiKeyOptional,
  onFetchModels,
}: {
  fetching: boolean
  canFetch: boolean
  apiKeyOptional?: boolean
  onFetchModels: () => void
}) {
  const { t } = useTranslation()
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 shrink-0 gap-1.5 px-3 text-xs"
      onClick={onFetchModels}
      disabled={fetching || !canFetch}
      title={fetchTitle(t, canFetch, apiKeyOptional)}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
      {t("settings.fetchModels")}
    </Button>
  )
}

function DefaultModelField({
  defaultModel,
  onDefaultModelChange,
  models,
  fetching,
  canFetch,
  fetchErr,
  showOpenAIHint,
  apiKeyOptional,
  onFetchModels,
}: {
  defaultModel: string
  onDefaultModelChange: (v: string) => void
  models: ModelInfo[] | null
  fetching: boolean
  canFetch: boolean
  fetchErr: string | null
  showOpenAIHint: boolean
  apiKeyOptional?: boolean
  onFetchModels: () => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsField label={t("settings.providerDefaultModel")}>
      <div className="flex gap-2">
        <Input
          value={defaultModel}
          onChange={(e) => onDefaultModelChange(e.target.value)}
          className="h-9 rounded-lg font-mono text-sm"
          placeholder={t("settings.defaultModelPlaceholder")}
        />
        <FetchModelsButton
          fetching={fetching}
          canFetch={canFetch}
          apiKeyOptional={apiKeyOptional}
          onFetchModels={onFetchModels}
        />
      </div>
      {fetchErr && (
        <p className="text-[11px] text-destructive">
          {t("settings.fetchModelsFailed")}: {fetchErr}
        </p>
      )}
      {showOpenAIHint && (
        <p className="text-[11px] text-muted-foreground">
          {t("settings.fetchModelsViaOpenAI")}
        </p>
      )}
      {models && models.length > 0 && (
        <FetchedModelSelect
          defaultModel={defaultModel}
          models={models}
          onChange={onDefaultModelChange}
        />
      )}
    </SettingsField>
  )
}

export function ModelFields({
  defaultModel,
  onDefaultModelChange,
  modelsPath,
  onModelsPathChange,
  apiStyle,
  models,
  fetching,
  canFetch,
  fetchErr,
  showOpenAIHint,
  apiKeyOptional,
  onFetchModels,
}: {
  defaultModel: string
  onDefaultModelChange: (v: string) => void
  modelsPath: string
  onModelsPathChange: (v: string) => void
  apiStyle: StyleOption
  models: ModelInfo[] | null
  fetching: boolean
  canFetch: boolean
  fetchErr: string | null
  showOpenAIHint: boolean
  apiKeyOptional?: boolean
  onFetchModels: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 gap-4">
      <DefaultModelField
        defaultModel={defaultModel}
        onDefaultModelChange={onDefaultModelChange}
        models={models}
        fetching={fetching}
        canFetch={canFetch}
        fetchErr={fetchErr}
        showOpenAIHint={showOpenAIHint}
        apiKeyOptional={apiKeyOptional}
        onFetchModels={onFetchModels}
      />
      <SettingsField label={t("settings.providerModelsPath")}>
        <Input
          value={modelsPath}
          onChange={(e) => onModelsPathChange(e.target.value)}
          className="h-9 rounded-lg font-mono text-sm"
          placeholder={defaultModelsPath(apiStyle)}
        />
      </SettingsField>
    </div>
  )
}
