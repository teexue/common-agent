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
import { Field, SectionCard } from "./shared"
import { formatTokenCount } from "@/lib/format"

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

export function RuntimeTab({
  form,
  setForm,
  knowledgeBases = [],
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
  knowledgeBases?: Array<{ id: string; name: string }>
}) {
  const { t } = useTranslation()
  const parallelLabel = t("common.parallel")
  const serialLabel = t("common.serial")

  const toggleKb = (id: string) => {
    setForm((prev) => {
      const selected = prev.knowledgeBases.includes(id)
      let tools = prev.tools
      let knowledgeBases = prev.knowledgeBases
      if (selected) {
        knowledgeBases = knowledgeBases.filter((x) => x !== id)
      } else {
        knowledgeBases = [...knowledgeBases, id]
        if (!tools.includes("knowledge_search"))
          tools = [...tools, "knowledge_search"]
        if (!tools.includes("knowledge_list"))
          tools = [...tools, "knowledge_list"]
      }
      return { ...prev, knowledgeBases, tools }
    })
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title={t("agent.sectionRuntime")}
        description={t("agent.sectionRuntimeDesc")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("agent.maxTurns")} hint={t("agent.maxTurnsHint")}>
            <Input
              type="number"
              value={form.maxTurns}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxTurns: Number(e.target.value) }))
              }
              className="h-9 rounded-xl font-mono text-sm"
              min={0}
              max={10000}
            />
          </Field>
          <Field label={t("agent.maxTokens")} hint={t("agent.maxTokensHint")}>
            <Select
              value={{
                value: form.maxTokens,
                label:
                  form.maxTokens > 0
                    ? formatTokenCount(form.maxTokens)
                    : t("agent.maxTokensAuto"),
              }}
              onValueChange={(v) => {
                if (v && typeof v === "object" && "value" in v) {
                  setForm((f) => ({
                    ...f,
                    maxTokens: (v as { value: number }).value,
                  }))
                }
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem
                  value={{ value: 0, label: t("agent.maxTokensAuto") }}
                >
                  {t("agent.maxTokensAuto")}
                </SelectItem>
                {MAX_TOKEN_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={t("agent.compactionStrategy")}
            hint={t("agent.compactionStrategyHint")}
          >
            <p className="flex h-9 items-center rounded-xl border border-border bg-muted/40 px-3 text-sm text-foreground">
              {t("agent.compactionStrategySmart")}
            </p>
          </Field>
          <Field
            label={t("agent.contextWindow")}
            hint={t("agent.contextWindowHint")}
          >
            <Select
              value={{
                value: form.contextWindow,
                label:
                  form.contextWindow > 0
                    ? formatTokenCount(form.contextWindow)
                    : t("agent.contextWindowUnset"),
              }}
              onValueChange={(v) => {
                if (v && typeof v === "object" && "value" in v) {
                  setForm((f) => ({
                    ...f,
                    contextWindow: (v as { value: number }).value,
                  }))
                }
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem
                  value={{ value: 0, label: t("agent.contextWindowUnset") }}
                >
                  {t("agent.contextWindowUnset")}
                </SelectItem>
                {CONTEXT_WINDOW_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("agent.execMode")} hint={t("agent.execModeHint")}>
            <Select
              value={{
                value: form.execMode,
                label:
                  form.execMode === "parallel" ? parallelLabel : serialLabel,
              }}
              onValueChange={(v) => {
                if (v && typeof v === "object" && "value" in v) {
                  setForm((f) => ({
                    ...f,
                    execMode: (v as { value: string }).value as
                      "parallel" | "serial",
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
          <Field
            label={t("agent.maxParallel")}
            hint={t("agent.maxParallelHint")}
          >
            <Input
              type="number"
              value={form.maxParallel}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxParallel: Number(e.target.value) }))
              }
              className="h-9 rounded-xl font-mono text-sm"
              min={1}
              max={16}
              disabled={form.execMode === "serial"}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title={t("agent.sectionKnowledge")}
        description={t("agent.sectionKnowledgeDesc")}
      >
        <Field
          label={t("agent.knowledgeTopK")}
          hint={t("agent.knowledgeTopKHint")}
        >
          <Input
            type="number"
            value={form.knowledgeTopK}
            onChange={(e) =>
              setForm((f) => ({ ...f, knowledgeTopK: Number(e.target.value) }))
            }
            className="h-9 rounded-xl font-mono text-sm"
            min={1}
            max={20}
          />
        </Field>
        {knowledgeBases.length === 0 ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            {t("agent.knowledgeEmpty")}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {knowledgeBases.map((kb) => {
              const selected = form.knowledgeBases.includes(kb.id)
              return (
                <button
                  key={kb.id}
                  type="button"
                  onClick={() => toggleKb(kb.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                    selected
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-background hover:bg-muted/40"
                  }`}
                >
                  <span>
                    <span className="font-medium text-foreground">
                      {kb.name}
                    </span>
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                      {kb.id}
                    </span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {selected ? t("common.selected") : t("common.select")}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t("agent.sectionOptimize")}
        description={t("agent.sectionOptimizeDesc")}
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.optimizeUserPrompt}
            onChange={(e) =>
              setForm((f) => ({ ...f, optimizeUserPrompt: e.target.checked }))
            }
            className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary"
          />
          <span>
            <span className="block text-xs font-medium text-foreground">
              {t("agent.optimizeUserPrompt")}
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
              {t("agent.optimizeUserPromptHint")}
            </span>
          </span>
        </label>
      </SectionCard>
    </div>
  )
}
