import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { AgentFormData } from "@/lib/agent-yaml"
import { optimizePrompt } from "@/lib/api"
import type { ProviderInfo } from "@/types/agent"
import { Field, SectionCard } from "./shared"

export function BasicTab({
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
  const currentProvider = providers.find((p) => p.name === form.provider)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeError, setOptimizeError] = useState<string | null>(null)

  // Manual, editor-triggered system prompt optimization: one LLM call using
  // the provider/model chosen in the form; the result stays editable here and
  // is only applied when the user saves the agent.
  const handleOptimizeSystemPrompt = async () => {
    if (!form.systemPrompt.trim() || optimizing) return
    setOptimizing(true)
    setOptimizeError(null)
    try {
      const result = await optimizePrompt(form.systemPrompt, {
        kind: "system",
        provider: form.provider,
        model: form.model,
      })
      setForm((f) => ({ ...f, systemPrompt: result.optimized_prompt }))
    } catch (err: unknown) {
      setOptimizeError(
        err instanceof Error ? err.message : t("agent.errOptimizeSystemPrompt")
      )
    } finally {
      setOptimizing(false)
    }
  }

  return (
    <div className="space-y-4">
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
          <Field label={t("agent.provider")}>
            <Select
              value={
                form.provider
                  ? {
                      value: form.provider,
                      label: currentProvider
                        ? `${currentProvider.display_name || currentProvider.name} (${currentProvider.api_style})`
                        : form.provider,
                    }
                  : null
              }
              onValueChange={(v) => {
                if (!v || typeof v !== "object" || !("value" in v)) return
                const name = (v as { value: string }).value
                const def = providers.find((p) => p.name === name)
                setForm((p) => ({
                  ...p,
                  provider: name,
                  model: def?.default_model || p.model,
                }))
              }}
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
                    <span className="text-muted-foreground">
                      ({p.api_style})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field
          label={t("agent.model")}
          hint={
            currentProvider
              ? t("agent.recommended", { model: currentProvider.default_model })
              : undefined
          }
        >
          <Input
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            placeholder={currentProvider?.default_model || t("agent.modelName")}
            className="h-9 rounded-xl font-mono text-sm"
          />
        </Field>
      </SectionCard>

      <SectionCard
        title={t("agent.systemPrompt")}
        description={t("agent.systemPromptDesc")}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {t("agent.optimizeSystemPromptHint")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs"
            onClick={handleOptimizeSystemPrompt}
            disabled={
              optimizing ||
              !form.systemPrompt.trim() ||
              !form.provider ||
              !form.model.trim()
            }
          >
            {optimizing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {optimizing
              ? t("agent.optimizing")
              : t("agent.optimizeSystemPrompt")}
          </Button>
        </div>
        <Textarea
          value={form.systemPrompt}
          onChange={(e) =>
            setForm((f) => ({ ...f, systemPrompt: e.target.value }))
          }
          placeholder="You are a helpful assistant."
          className="min-h-40 resize-y rounded-xl font-mono text-sm leading-relaxed"
        />
        {optimizeError && (
          <p className="text-[11px] leading-relaxed text-destructive">
            {optimizeError}
          </p>
        )}
      </SectionCard>
    </div>
  )
}
