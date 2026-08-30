import type { ProviderInfo } from "@/types/agent"
import { IdentityFields } from "./provider-identity-fields"
import {
  ApiKeyField,
  AuthStyleField,
  BaseURLField,
} from "./provider-connection-fields"
import { ModelFields, ModelsPathField } from "./provider-model-fields"
import { FormActions, VisionToggle } from "./provider-form-actions"
import { VendorSelect } from "./provider-vendor-select"
import { ModelDetailCard } from "./model-detail-card"
import { FormError } from "./form-error"
import { useProviderForm, type ProviderFormModel } from "./use-provider-form"

function ProviderFormFields({ form }: { form: ProviderFormModel }) {
  const f = form.fields
  const v = form.vendors
  return (
    <>
      {!f.isEdit && v.vendors.length > 0 && (
        <VendorSelect
          vendors={v.vendors}
          vendorName={v.vendorName}
          onApply={form.applyVendor}
        />
      )}
      <IdentityFields
        isEdit={f.isEdit}
        name={f.name}
        onNameChange={f.setName}
        displayName={f.displayName}
        onDisplayNameChange={f.setDisplayName}
        selectedVendor={v.selectedVendor}
        apiStyle={f.apiStyle}
        styleOptions={
          v.selectedVendor?.supported_styles ?? ["openai", "anthropic"]
        }
        onStyleChange={form.onStyleChange}
      />
      <BaseURLField
        baseURL={f.baseURL}
        onBaseURLChange={(url) => {
          f.setBaseURL(url)
          f.setBaseURLTouched(true)
        }}
      />
      {f.apiStyle === "anthropic" && (
        <AuthStyleField
          authStyle={f.authStyle}
          onAuthStyleChange={f.setAuthStyle}
        />
      )}
      <ApiKeyField
        isEdit={f.isEdit}
        apiKey={f.apiKey}
        onApiKeyChange={f.setApiKey}
        optional={!form.requiresKey}
      />
    </>
  )
}

function ProviderModelSection({ form }: { form: ProviderFormModel }) {
  const f = form.fields
  const d = form.detail
  const m = form.models
  return (
    <>
      <ModelsPathField
        modelsPath={f.modelsPath}
        onModelsPathChange={(v) => {
          f.setModelsPath(v)
          f.setModelsPathTouched(true)
        }}
      />
      <ModelFields
        defaultModel={f.defaultModel}
        onDefaultModelChange={(value) => {
          if (!value.trim()) d.clearDetail()
          f.setDefaultModel(value)
        }}
        enabledModels={f.enabledModels}
        onEnabledModelsChange={f.setEnabledModels}
        models={m.models}
        fetching={m.fetching}
        canFetch={form.canFetch}
        fetchErr={m.fetchErr}
        showOpenAIHint={
          f.apiStyle === "anthropic" &&
          !!form.vendors.selectedVendor?.supported_styles?.includes("openai") &&
          !m.fetchErr
        }
      />
      {d.detailSupported && (
        <ModelDetailCard
          detail={d.detail}
          loading={d.detailLoading}
          err={d.detailErr}
          empty={d.detailEmpty}
          onRefresh={d.loadDetail}
        />
      )}
    </>
  )
}

export function ProviderForm({
  provider,
  onSaved,
  onCancel,
}: {
  provider?: ProviderInfo
  onSaved: () => void
  onCancel: () => void
}) {
  const form = useProviderForm(provider, onSaved)
  const f = form.fields
  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-card p-5">
      <ProviderFormFields form={form} />
      <ProviderModelSection form={form} />
      <VisionToggle vision={f.vision} onToggle={() => f.setVision(!f.vision)} />
      <FormError error={form.save.error} />
      <FormActions
        saving={form.save.saving}
        canSave={form.canSave}
        onCancel={onCancel}
        onSave={form.save.handleSave}
      />
    </div>
  )
}
