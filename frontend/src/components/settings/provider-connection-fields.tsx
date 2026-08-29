import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { SettingsField } from "./settings-field"
import { SettingsSelect } from "./settings-select"
import type { AuthStyle } from "./provider-form-utils"

export function BaseURLField({
  baseURL,
  onBaseURLChange,
}: {
  baseURL: string
  onBaseURLChange: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsField label={t("settings.providerBaseURL")}>
      <Input
        value={baseURL}
        onChange={(e) => onBaseURLChange(e.target.value)}
        className="h-9 rounded-lg font-mono text-sm"
        placeholder={t("settings.baseURLPlaceholder")}
      />
    </SettingsField>
  )
}

const AUTH_OPTIONS = [
  { value: "x-api-key", label: "x-api-key" },
  { value: "bearer", label: "Authorization: Bearer" },
]

export function AuthStyleField({
  authStyle,
  onAuthStyleChange,
}: {
  authStyle: AuthStyle
  onAuthStyleChange: (v: "x-api-key" | "bearer") => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsField label={t("settings.providerAuthStyle")}>
      <SettingsSelect
        value={authStyle || "x-api-key"}
        options={AUTH_OPTIONS}
        onChange={(v) => onAuthStyleChange(v as "x-api-key" | "bearer")}
      />
    </SettingsField>
  )
}

function apiKeyPlaceholder(
  t: (key: string) => string,
  isEdit: boolean,
  optional?: boolean
): string {
  if (isEdit) return t("settings.keepExisting")
  if (optional) return t("settings.apiKeyOptionalPlaceholder")
  return t("settings.apiKeyPlaceholder")
}

function ApiKeyHint({
  isEdit,
  optional,
}: {
  isEdit: boolean
  optional?: boolean
}) {
  const { t } = useTranslation()
  if (isEdit) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {t("settings.apiKeyHint")}
      </p>
    )
  }
  if (optional) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {t("settings.apiKeyOptionalHint")}
      </p>
    )
  }
  return null
}

export function ApiKeyField({
  isEdit,
  apiKey,
  onApiKeyChange,
  optional,
}: {
  isEdit: boolean
  apiKey: string
  onApiKeyChange: (v: string) => void
  optional?: boolean
}) {
  const { t } = useTranslation()
  return (
    <SettingsField
      label={
        <>
          {t("settings.providerApiKey")}
          {optional && (
            <span className="ml-1 text-[10px] font-normal text-muted-foreground/70">
              ({t("settings.optional")})
            </span>
          )}
        </>
      }
    >
      <Input
        type="password"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
        className="h-9 rounded-lg font-mono text-sm"
        placeholder={apiKeyPlaceholder(t, isEdit, optional)}
        autoComplete="off"
      />
      <ApiKeyHint isEdit={isEdit} optional={optional} />
    </SettingsField>
  )
}
