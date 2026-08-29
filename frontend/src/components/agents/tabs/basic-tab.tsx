import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { AgentFormData } from "@/lib/agent-yaml"
import { optimizePrompt } from "@/lib/api"
import type { ProviderInfo } from "@/types/agent"
import { SectionCard } from "./shared"
import { BasicIdentityFields } from "./basic-identity-fields"

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
  return (
    <div className="space-y-4">
      <BasicIdentityFields
        form={form}
        setForm={setForm}
        providers={providers}
        isCreate={isCreate}
      />
      <BasicPromptCard form={form} setForm={setForm} />
    </div>
  )
}

function BasicPromptCard({
  form,
  setForm,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
}) {
  const { t } = useTranslation()
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeError, setOptimizeError] = useState<string | null>(null)

  return (
    <SectionCard
      title={t("agent.systemPrompt")}
      description={t("agent.systemPromptDesc")}
    >
      <OptimizePromptBar
        form={form}
        optimizing={optimizing}
        onOptimize={() =>
          void runOptimize(form, setForm, setOptimizing, setOptimizeError, t)
        }
      />
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
  )
}

function OptimizePromptBar({
  form,
  optimizing,
  onOptimize,
}: {
  form: AgentFormData
  optimizing: boolean
  onOptimize: () => void
}) {
  const { t } = useTranslation()
  const disabled =
    optimizing ||
    !form.systemPrompt.trim() ||
    !form.provider ||
    !form.model.trim()
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {t("agent.optimizeSystemPromptHint")}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="h-7 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs"
        onClick={onOptimize}
        disabled={disabled}
      >
        {optimizing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {optimizing ? t("agent.optimizing") : t("agent.optimizeSystemPrompt")}
      </Button>
    </div>
  )
}

async function runOptimize(
  form: AgentFormData,
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>,
  setOptimizing: (v: boolean) => void,
  setOptimizeError: (v: string | null) => void,
  t: (key: string) => string
) {
  if (!form.systemPrompt.trim()) return
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
