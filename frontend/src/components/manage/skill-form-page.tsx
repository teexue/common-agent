import { useTranslation } from "react-i18next"
import { Loader2, Puzzle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import type { AgentInfo, SkillInfo } from "@/types/agent"
import { SkillFormFields } from "./skill-form-fields"
import {
  submitSkillForm,
  useSkillForm,
  type SkillFormState,
} from "./use-skill-form"

interface SkillFormPageProps {
  mode: "create" | "edit"
  skill: SkillInfo | null
  onBack: () => void
  onSaved: () => void
}

export function SkillFormPage(props: SkillFormPageProps) {
  const { t } = useTranslation()
  const state = useSkillForm({ mode: props.mode, skill: props.skill })
  const setField = <K extends keyof SkillFormState>(
    key: K,
    value: SkillFormState[K]
  ) => state.setForm((f) => ({ ...f, [key]: value }))
  const save = () =>
    void submitSkillForm({
      mode: props.mode,
      skill: props.skill,
      form: state.form,
      t,
      setError: state.setError,
      setSaving: state.setSaving,
      onSaved: props.onSaved,
    })

  return (
    <PageShell>
      <PageHeader
        icon={Puzzle}
        title={
          props.mode === "edit"
            ? t("manage.skillsEditTitle")
            : t("manage.skillsCreateTitle")
        }
        actions={
          <SkillFormActions
            saving={state.saving}
            disabled={
              state.detailLoading ||
              (state.form.scope === "agent" && !state.form.agent)
            }
            onBack={props.onBack}
            onSave={save}
          />
        }
      />
      <PageMain contentClassName="max-w-3xl">
        <SkillFormMain
          loading={state.detailLoading}
          mode={props.mode}
          form={state.form}
          setField={setField}
          agents={state.agents}
          error={state.error}
          onSubmit={(e) => {
            e?.preventDefault()
            save()
          }}
        />
      </PageMain>
    </PageShell>
  )
}

function SkillFormMain({
  loading,
  mode,
  form,
  setField,
  agents,
  error,
  onSubmit,
}: {
  loading: boolean
  mode: "create" | "edit"
  form: SkillFormState
  setField: <K extends keyof SkillFormState>(
    key: K,
    value: SkillFormState[K]
  ) => void
  agents: AgentInfo[]
  error: string
  onSubmit: (e?: React.FormEvent) => void
}) {
  const { t } = useTranslation()
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("manage.loading")}
      </div>
    )
  }
  return (
    <SkillFormFields
      mode={mode}
      form={form}
      setField={setField}
      agents={agents}
      error={error}
      onSubmit={onSubmit}
    />
  )
}

function SkillFormActions({
  saving,
  disabled,
  onBack,
  onSave,
}: {
  saving: boolean
  disabled: boolean
  onBack: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={onBack}
      >
        {t("common.cancel")}
      </Button>
      <Button
        size="sm"
        className="h-8 gap-1.5 text-xs"
        disabled={saving || disabled}
        onClick={onSave}
      >
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t("common.save")}
      </Button>
    </>
  )
}
