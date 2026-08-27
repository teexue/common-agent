import { useTranslation } from "react-i18next"
import { Eye, RefreshCw } from "lucide-react"
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
import type { ModelInfo, VendorInfo } from "@/types/agent"
import { defaultModelsPath, type StyleOption } from "./provider-form-utils"

export function VendorSelect({
  vendors,
  vendorName,
  selectedVendor,
  onApply,
}: {
  vendors: VendorInfo[]
  vendorName: string
  selectedVendor: VendorInfo | null
  onApply: (v: VendorInfo) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {t("settings.providerVendor")}
      </Label>
      <Select
        value={
          vendorName
            ? {
                value: vendorName,
                label: selectedVendor?.display_name ?? vendorName,
              }
            : null
        }
        onValueChange={(v) => {
          if (v && typeof v === "object" && "value" in v) {
            const found = vendors.find(
              (x) => x.name === (v as { value: string }).value
            )
            if (found) onApply(found)
          }
        }}
      >
        <SelectTrigger className="h-9 w-full rounded-lg text-sm">
          <SelectValue placeholder={t("settings.providerVendorPlaceholder")} />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {vendors.map((v) => (
            <SelectItem
              key={v.name}
              value={{ value: v.name, label: v.display_name }}
            >
              {v.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function IdentityFields({
  isEdit,
  name,
  onNameChange,
  displayName,
  onDisplayNameChange,
  selectedVendor,
  apiStyle,
  styleOptions,
  onStyleChange,
}: {
  isEdit: boolean
  name: string
  onNameChange: (v: string) => void
  displayName: string
  onDisplayNameChange: (v: string) => void
  selectedVendor: VendorInfo | null
  apiStyle: StyleOption
  styleOptions: StyleOption[]
  onStyleChange: (style: StyleOption) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("settings.providerName")}
        </Label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={isEdit}
          className="h-9 rounded-lg font-mono text-sm"
          placeholder="moonshot"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("settings.providerDisplayName")}
        </Label>
        <Input
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          className="h-9 rounded-lg text-sm"
          placeholder={selectedVendor?.display_name ?? name ?? "My Provider"}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("settings.providerAPIStyle")}
        </Label>
        <Select
          value={{ value: apiStyle, label: apiStyle }}
          onValueChange={(v) => {
            if (v && typeof v === "object" && "value" in v)
              onStyleChange((v as { value: string }).value as StyleOption)
          }}
        >
          <SelectTrigger className="h-9 w-full rounded-lg text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {styleOptions.map((s) => (
              <SelectItem key={s} value={{ value: s, label: s }}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function BaseURLField({
  baseURL,
  onBaseURLChange,
}: {
  baseURL: string
  onBaseURLChange: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {t("settings.providerBaseURL")}
      </Label>
      <Input
        value={baseURL}
        onChange={(e) => onBaseURLChange(e.target.value)}
        className="h-9 rounded-lg font-mono text-sm"
        placeholder={t("settings.baseURLPlaceholder")}
      />
    </div>
  )
}

export function AuthStyleField({
  authStyle,
  onAuthStyleChange,
}: {
  authStyle: "x-api-key" | "bearer" | ""
  onAuthStyleChange: (v: "x-api-key" | "bearer") => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {t("settings.providerAuthStyle")}
      </Label>
      <Select
        value={{
          value: authStyle || "x-api-key",
          label:
            (authStyle || "x-api-key") === "bearer"
              ? "Authorization: Bearer"
              : "x-api-key",
        }}
        onValueChange={(v) => {
          if (v && typeof v === "object" && "value" in v)
            onAuthStyleChange(
              (v as { value: string }).value as "x-api-key" | "bearer"
            )
        }}
      >
        <SelectTrigger className="h-9 w-full rounded-lg text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value={{ value: "x-api-key", label: "x-api-key" }}>
            x-api-key
          </SelectItem>
          <SelectItem
            value={{ value: "bearer", label: "Authorization: Bearer" }}
          >
            Authorization: Bearer
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
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
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {t("settings.providerApiKey")}
        {optional && (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground/70">
            ({t("settings.optional")})
          </span>
        )}
      </Label>
      <Input
        type="password"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
        className="h-9 rounded-lg font-mono text-sm"
        placeholder={
          isEdit
            ? t("settings.keepExisting")
            : optional
              ? t("settings.apiKeyOptionalPlaceholder")
              : t("settings.apiKeyPlaceholder")
        }
        autoComplete="off"
      />
      {isEdit ? (
        <p className="text-[11px] text-muted-foreground">
          {t("settings.apiKeyHint")}
        </p>
      ) : optional ? (
        <p className="text-[11px] text-muted-foreground">
          {t("settings.apiKeyOptionalHint")}
        </p>
      ) : null}
    </div>
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
  const fetchTitle = canFetch
    ? apiKeyOptional
      ? t("settings.fetchModelsLocalHint")
      : t("settings.fetchModelsHint")
    : t("settings.fetchModelsNoKey")
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("settings.providerDefaultModel")}
        </Label>
        <div className="flex gap-2">
          <Input
            value={defaultModel}
            onChange={(e) => onDefaultModelChange(e.target.value)}
            className="h-9 rounded-lg font-mono text-sm"
            placeholder={t("settings.defaultModelPlaceholder")}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5 px-3 text-xs"
            onClick={onFetchModels}
            disabled={fetching || !canFetch}
            title={fetchTitle}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`}
            />
            {t("settings.fetchModels")}
          </Button>
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
          <Select
            value={
              defaultModel ? { value: defaultModel, label: defaultModel } : null
            }
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v)
                onDefaultModelChange((v as { value: string }).value)
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-lg text-sm">
              <SelectValue placeholder={t("settings.fetchModelsPick")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {models.map((m) => (
                <SelectItem key={m.id} value={{ value: m.id, label: m.id }}>
                  {m.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("settings.providerModelsPath")}
        </Label>
        <Input
          value={modelsPath}
          onChange={(e) => onModelsPathChange(e.target.value)}
          className="h-9 rounded-lg font-mono text-sm"
          placeholder={defaultModelsPath(apiStyle)}
        />
      </div>
    </div>
  )
}

type VisionToggleProps = { vision: boolean; onToggle: () => void }

export function VisionToggle({ vision, onToggle }: VisionToggleProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${vision ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
      >
        <Eye className="h-3.5 w-3.5" /> {t("settings.providerVision")}
      </button>
    </div>
  )
}

export function FormActions({
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
        {t("settings.cancel")}
      </Button>
      <Button
        size="sm"
        className="h-8 gap-1.5 px-4 text-xs"
        onClick={onSave}
        disabled={saving || !canSave}
      >
        {saving ? t("settings.loading") : t("settings.save")}
      </Button>
    </div>
  )
}
