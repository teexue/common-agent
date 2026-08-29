import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AgentFormData } from "@/lib/agent-yaml"
import type { ProviderInfo } from "@/types/agent"
import { Field, SectionCard } from "./shared"

export function BasicIdentityFields({
  form,
  setForm,
  providers,
  isCreate,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
  providers: ProviderInfo[]
  isCreate: boolean
}) {
  const { t } = useTranslation()
  const current = providers.find((p) => p.name === form.provider)
  return (
    <SectionCard
      title={t("agent.sectionIdentity")}
      description={t("agent.sectionIdentityDesc")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("agent.name")} hint={t("agent.nameHint")}>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="my-agent"
            className="h-9 rounded-xl text-sm"
          />
        </Field>
        {!isCreate && form.id && (
          <Field label={t("agent.id")} hint={t("agent.idHint")}>
            <Input
              value={form.id}
              disabled
              className="h-9 rounded-xl font-mono text-sm text-muted-foreground"
            />
          </Field>
        )}
        <ProviderSelect
          form={form}
          setForm={setForm}
          providers={providers}
          current={current}
        />
      </div>
      <ModelField form={form} setForm={setForm} current={current} />
    </SectionCard>
  )
}

function ProviderSelect({
  form,
  setForm,
  providers,
  current,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
  providers: ProviderInfo[]
  current: ProviderInfo | undefined
}) {
  const { t } = useTranslation()
  return (
    <Field label={t("agent.provider")}>
      <Select
        value={
          form.provider
            ? {
                value: form.provider,
                label: current
                  ? `${current.display_name || current.name} (${current.api_style})`
                  : form.provider,
              }
            : null
        }
        onValueChange={(v) => applyProvider(v, providers, setForm)}
      >
        <SelectTrigger className="h-9 w-full rounded-xl">
          <SelectValue placeholder={t("agent.selectProvider")} />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {providers.map((p) => (
            <SelectItem
              key={p.name}
              value={{
                value: p.name,
                label: `${p.display_name || p.name} (${p.api_style})`,
              }}
            >
              {p.display_name || p.name}{" "}
              <span className="text-muted-foreground">({p.api_style})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function ModelField({
  form,
  setForm,
  current,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
  current: ProviderInfo | undefined
}) {
  const { t } = useTranslation()
  return (
    <Field
      label={t("agent.model")}
      hint={
        current
          ? t("agent.recommended", { model: current.default_model })
          : undefined
      }
    >
      <Input
        value={form.model}
        onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
        placeholder={current?.default_model || t("agent.modelName")}
        className="h-9 rounded-xl font-mono text-sm"
      />
    </Field>
  )
}

function applyProvider(
  v: unknown,
  providers: ProviderInfo[],
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
) {
  if (!v || typeof v !== "object" || !("value" in v)) return
  const name = (v as { value: string }).value
  const def = providers.find((p) => p.name === name)
  setForm((p) => ({
    ...p,
    provider: name,
    model: def?.default_model || p.model,
  }))
}
