import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AgentFormData } from "@/lib/agent-yaml"
import { formatTokenCount } from "@/lib/format"
import { Field } from "./shared"

const MAX_TOKEN_OPTIONS = [
  { value: 8000, label: "8K" },
  { value: 16000, label: "16K" },
  { value: 32000, label: "32K" },
  { value: 64000, label: "64K" },
  { value: 128000, label: "128K" },
]

const CONTEXT_WINDOW_OPTIONS = [
  { value: 128000, label: "128K" },
  { value: 256000, label: "256K" },
  { value: 384000, label: "384K" },
  { value: 1000000, label: "1M" },
]

export function RuntimeSelects({
  form,
  setForm,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
}) {
  return (
    <>
      <MaxTokensField form={form} setForm={setForm} />
      <CompactionField />
      <ContextWindowField form={form} setForm={setForm} />
      <ExecModeField form={form} setForm={setForm} />
    </>
  )
}

function MaxTokensField({
  form,
  setForm,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
}) {
  const { t } = useTranslation()
  const auto = t("agent.maxTokensAuto")
  return (
    <Field label={t("agent.maxTokens")} hint={t("agent.maxTokensHint")}>
      <TokenSelect
        value={form.maxTokens}
        unsetLabel={auto}
        options={MAX_TOKEN_OPTIONS}
        onChange={(n) => setForm((f) => ({ ...f, maxTokens: n }))}
      />
    </Field>
  )
}

function CompactionField() {
  const { t } = useTranslation()
  return (
    <Field
      label={t("agent.compactionStrategy")}
      hint={t("agent.compactionStrategyHint")}
    >
      <p className="flex h-9 items-center rounded-xl border border-border bg-muted/40 px-3 text-sm text-foreground">
        {t("agent.compactionStrategySmart")}
      </p>
    </Field>
  )
}

function ContextWindowField({
  form,
  setForm,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
}) {
  const { t } = useTranslation()
  const unset = t("agent.contextWindowUnset")
  return (
    <Field label={t("agent.contextWindow")} hint={t("agent.contextWindowHint")}>
      <TokenSelect
        value={form.contextWindow}
        unsetLabel={unset}
        options={CONTEXT_WINDOW_OPTIONS}
        onChange={(n) => setForm((f) => ({ ...f, contextWindow: n }))}
      />
    </Field>
  )
}

function ExecModeField({
  form,
  setForm,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
}) {
  const { t } = useTranslation()
  const parallelLabel = t("common.parallel")
  const serialLabel = t("common.serial")
  return (
    <Field label={t("agent.execMode")} hint={t("agent.execModeHint")}>
      <Select
        value={{
          value: form.execMode,
          label: form.execMode === "parallel" ? parallelLabel : serialLabel,
        }}
        onValueChange={(v) => {
          if (v && typeof v === "object" && "value" in v) {
            setForm((f) => ({
              ...f,
              execMode: (v as { value: string }).value as "parallel" | "serial",
            }))
          }
        }}
      >
        <SelectTrigger className="h-9 w-full rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value={{ value: "parallel", label: parallelLabel }}>
            {parallelLabel}
          </SelectItem>
          <SelectItem value={{ value: "serial", label: serialLabel }}>
            {serialLabel}
          </SelectItem>
        </SelectContent>
      </Select>
    </Field>
  )
}

function TokenSelect({
  value,
  unsetLabel,
  options,
  onChange,
}: {
  value: number
  unsetLabel: string
  options: Array<{ value: number; label: string }>
  onChange: (n: number) => void
}) {
  return (
    <Select
      value={{
        value,
        label: value > 0 ? formatTokenCount(value) : unsetLabel,
      }}
      onValueChange={(v) => {
        if (v && typeof v === "object" && "value" in v) {
          onChange((v as { value: number }).value)
        }
      }}
    >
      <SelectTrigger className="h-9 w-full rounded-xl">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        <SelectItem value={{ value: 0, label: unsetLabel }}>
          {unsetLabel}
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
