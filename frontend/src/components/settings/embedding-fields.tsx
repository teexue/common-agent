import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import type { EmbeddingVendorInfo } from "@/types/agent"
import { SettingsField } from "./settings-field"
import { SettingsSelect } from "./settings-select"
import {
  applyEmbeddingVendor,
  type EmbeddingFormState,
} from "./use-embedding-form"

const triggerClass = "h-9 w-full rounded-xl text-xs"
const monoTrigger = "h-9 w-full rounded-xl font-mono text-xs"

export function EmbeddingVendorField({
  vendors,
  vendorName,
  form,
}: {
  vendors: EmbeddingVendorInfo[]
  vendorName: string
  form: EmbeddingFormState
}) {
  const { t } = useTranslation()
  if (vendors.length === 0) return null
  return (
    <SettingsField label={t("settings.embeddingVendor")}>
      <SettingsSelect
        value={vendorName}
        options={vendors.map((v) => ({
          value: v.name,
          label: v.display_name,
        }))}
        placeholder={t("settings.embeddingVendorPlaceholder")}
        triggerClassName={triggerClass}
        onChange={(name) => {
          const found = vendors.find((x) => x.name === name)
          if (found) applyEmbeddingVendor(found, form)
        }}
      />
    </SettingsField>
  )
}

export function EmbeddingBaseUrlField({
  baseURL,
  onChange,
}: {
  baseURL: string
  onChange: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsField
      label={t("settings.embeddingBaseUrl")}
      hint={t("settings.embeddingBaseUrlHint")}
    >
      <Input
        value={baseURL}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
        className="h-9 rounded-xl font-mono text-xs"
      />
    </SettingsField>
  )
}

export function EmbeddingKeyFields({
  apiKeyEnv,
  apiKey,
  hasAPIKey,
  onEnvChange,
  onKeyChange,
}: {
  apiKeyEnv: string
  apiKey: string
  hasAPIKey: boolean
  onEnvChange: (v: string) => void
  onKeyChange: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <SettingsField label={t("settings.embeddingApiKeyEnv")}>
        <Input
          value={apiKeyEnv}
          onChange={(e) => onEnvChange(e.target.value)}
          placeholder="DASHSCOPE_API_KEY"
          className="h-9 rounded-xl font-mono text-xs"
        />
      </SettingsField>
      <SettingsField
        label={`${t("settings.embeddingApiKey")}${hasAPIKey ? ` (${t("settings.embeddingApiKeySet")})` : ""}`}
      >
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder={hasAPIKey ? t("settings.embeddingApiKeyKeep") : "sk-..."}
          className="h-9 rounded-xl font-mono text-xs"
        />
      </SettingsField>
    </>
  )
}

export function EmbeddingModelField({
  model,
  backend,
  options,
  onChange,
}: {
  model: string
  backend: string
  options: string[]
  onChange: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsField label={t("settings.embeddingModel")}>
      {options.length > 0 ? (
        <SettingsSelect
          value={model}
          options={options.map((m) => ({ value: m, label: m }))}
          placeholder={t("settings.embeddingModelPlaceholder")}
          triggerClassName={monoTrigger}
          onChange={onChange}
        />
      ) : (
        <Input
          value={model}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            backend === "ollama" ? "nomic-embed-text" : "text-embedding-v4"
          }
          className="h-9 rounded-xl font-mono text-xs"
        />
      )}
    </SettingsField>
  )
}

export function EmbeddingDimensionsField({
  dimensions,
  options,
  onChange,
}: {
  dimensions: number | ""
  options: number[]
  onChange: (v: number | "") => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsField
      label={t("settings.embeddingDimensions")}
      hint={t("settings.embeddingDimensionsHint")}
    >
      <SettingsSelect
        value={typeof dimensions === "number" ? String(dimensions) : ""}
        options={options.map((d) => ({ value: String(d), label: String(d) }))}
        placeholder={t("settings.embeddingDimensionsPlaceholder")}
        triggerClassName={monoTrigger}
        onChange={(v) => {
          const n = Number(v)
          onChange(Number.isFinite(n) && n > 0 ? n : "")
        }}
      />
    </SettingsField>
  )
}
