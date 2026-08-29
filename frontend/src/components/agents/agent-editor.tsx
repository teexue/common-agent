import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Bot, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { AgentEditorActions } from "./agent-editor-actions"
import { AgentEditorTabs } from "./agent-editor-tabs"
import { useAgentCatalog, useAgentForm, useAgentSave } from "./use-agent-editor"

interface AgentEditorPageProps {
  agentId?: string | null
  copyFrom?: string | null
  onBack: () => void
  onSaved?: (id: string) => void
}

function editorTitle(
  t: (key: string, opts?: Record<string, string>) => string,
  isCreate: boolean,
  copyFrom: string | null,
  name: string
) {
  if (isCreate && copyFrom) return t("agent.copyTitle", { name: copyFrom })
  if (isCreate) return t("agent.createTitle")
  return t("agent.editTitle", { name })
}

export function AgentEditorPage({
  agentId = null,
  copyFrom = null,
  onBack,
  onSaved,
}: AgentEditorPageProps) {
  const { t } = useTranslation()
  const { providers, tools, knowledgeBases } = useAgentCatalog()
  const { form, setForm, loading, error, setError, isCreate } = useAgentForm(
    agentId,
    copyFrom
  )
  const [tab, setTab] = useState("basic")
  const { saving, handleSave } = useAgentSave({
    form,
    isCreate,
    agentId,
    onSaved,
    setError,
    setTab,
  })

  return (
    <PageShell>
      <PageHeader
        icon={Bot}
        title={editorTitle(t, isCreate, copyFrom, form.name || agentId || "")}
        description={t("agent.editorSubtitle")}
        actions={
          <AgentEditorActions
            onBack={onBack}
            onSave={() => void handleSave()}
            saving={saving}
            loading={loading}
          />
        }
      />
      <PageMain contentClassName="mx-auto max-w-3xl">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AgentEditorTabs
            form={form}
            setForm={setForm}
            providers={providers}
            tools={tools}
            knowledgeBases={knowledgeBases}
            tab={tab}
            setTab={setTab}
            error={error}
            isCreate={isCreate}
          />
        )}
      </PageMain>
    </PageShell>
  )
}
