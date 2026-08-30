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
import {
  chatModelOptions,
  modelChoiceKey,
  parseModelChoice,
  withCurrentChatOption,
  type ChatModelOption,
} from "@/lib/provider-models"
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
      </div>
      <ModelField form={form} setForm={setForm} providers={providers} />
    </SectionCard>
  )
}

function ModelField({
  form,
  setForm,
  providers,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
  providers: ProviderInfo[]
}) {
  const { t } = useTranslation()
  const enabled = chatModelOptions(providers)
  const options = withCurrentChatOption(
    enabled,
    { provider: form.provider, model: form.model },
    providers
  )
  const listed = enabled.some(
    (o) => o.provider === form.provider && o.model === form.model
  )
  return (
    <Field
      label={t("agent.defaultModel")}
      hint={
        form.model && !listed
          ? t("agent.modelNotEnabledHint")
          : t("agent.defaultModelHint")
      }
    >
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("conversation.noEnabledModels")}
        </p>
      ) : (
        <ModelSelect
          options={options}
          selected={form.model ? modelChoiceKey(form.provider, form.model) : ""}
          onChange={(v) => applyModelChoice(v, setForm)}
        />
      )}
    </Field>
  )
}

function ModelSelect({
  options,
  selected,
  onChange,
}: {
  options: ChatModelOption[]
  selected: string
  onChange: (v: unknown) => void
}) {
  const { t } = useTranslation()
  const current = options.find(
    (o) => modelChoiceKey(o.provider, o.model) === selected
  )
  return (
    <Select
      value={
        current
          ? {
              value: selected,
              label: `${current.model} · ${current.providerLabel}`,
            }
          : null
      }
      onValueChange={onChange}
    >
      <SelectTrigger className="h-9 w-full rounded-xl">
        <SelectValue placeholder={t("agent.selectDefaultModel")} />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {options.map((o) => {
          const key = modelChoiceKey(o.provider, o.model)
          return (
            <SelectItem
              key={key}
              value={{ value: key, label: `${o.model} · ${o.providerLabel}` }}
            >
              <span className="font-mono">{o.model}</span>{" "}
              <span className="text-muted-foreground">{o.providerLabel}</span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

function applyModelChoice(
  v: unknown,
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
) {
  if (!v || typeof v !== "object" || !("value" in v)) return
  const { provider, model } = parseModelChoice((v as { value: string }).value)
  setForm((f) => ({ ...f, provider, model }))
}
