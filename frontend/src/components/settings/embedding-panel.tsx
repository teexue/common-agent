import { useTranslation } from "react-i18next"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormError, FormOk } from "./form-error"
import {
  EmbeddingBaseUrlField,
  EmbeddingDimensionsField,
  EmbeddingKeyFields,
  EmbeddingModelField,
  EmbeddingVendorField,
} from "./embedding-fields"
import {
  saveEmbeddingForm,
  useEmbeddingDerived,
  useEmbeddingState,
} from "./use-embedding-form"

function EmbeddingSaveButton({
  saving,
  canSave,
  onSave,
}: {
  saving: boolean
  canSave: boolean
  onSave: () => void
}) {
  const { t } = useTranslation()
  return (
    <Button
      size="sm"
      className="h-8 gap-1.5 text-xs"
      disabled={saving || !canSave}
      onClick={onSave}
    >
      {saving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Save className="h-3.5 w-3.5" />
      )}
      {t("common.save")}
    </Button>
  )
}

function EmbeddingFormBody() {
  const { t } = useTranslation()
  const form = useEmbeddingState()
  const derived = useEmbeddingDerived(form)
  if (form.loading) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("settings.mcpLoading")}
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t("settings.embeddingHint")}
      </p>
      <EmbeddingVendorField
        vendors={form.vendors}
        vendorName={form.vendorName}
        form={form}
      />
      <EmbeddingBaseUrlField
        baseURL={form.baseURL}
        onChange={form.setBaseURL}
      />
      {derived.needsKey && (
        <EmbeddingKeyFields
          apiKeyEnv={form.apiKeyEnv}
          apiKey={form.apiKey}
          hasAPIKey={form.hasAPIKey}
          onEnvChange={form.setApiKeyEnv}
          onKeyChange={form.setApiKey}
        />
      )}
      <EmbeddingModelField
        model={form.model}
        backend={form.backend}
        options={derived.modelOptions}
        onChange={form.setModel}
      />
      {derived.showDimensions && (
        <EmbeddingDimensionsField
          dimensions={form.dimensions}
          options={derived.dimensionOptions}
          onChange={form.setDimensions}
        />
      )}
      <FormError error={form.error} />
      <FormOk message={form.ok ? t("settings.embeddingSaved") : null} />
      <EmbeddingSaveButton
        saving={form.saving}
        canSave={derived.canSave}
        onSave={() => void saveEmbeddingForm(form, derived.needsKey)}
      />
    </div>
  )
}

/** Settings panel for embedding backend used by RAG (independent of chat providers). */
export function EmbeddingPanel() {
  return <EmbeddingFormBody />
}
