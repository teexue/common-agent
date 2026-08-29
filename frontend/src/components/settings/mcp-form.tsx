import { useState } from "react"
import { upsertGlobalMCP } from "@/lib/api"
import { FormError } from "./form-error"
import {
  McpEnvField,
  McpFormActions,
  McpIdentityFields,
  McpSseField,
  McpStdioFields,
} from "./mcp-form-fields"
import { emptyForm, toMcpPayload, type GlobalFormState } from "./mcp-form-state"
import { errMessage } from "./select-value"

export function GlobalMCPForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: GlobalFormState
  onSaved: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<GlobalFormState>(initial ?? emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const patch = (partial: Partial<GlobalFormState>) =>
    setForm((f) => ({ ...f, ...partial }))
  const canSave =
    form.name.trim() !== "" &&
    (form.type === "sse" ? form.url.trim() !== "" : form.command.trim() !== "")
  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await upsertGlobalMCP(toMcpPayload(form))
      onSaved()
    } catch (e: unknown) {
      setError(errMessage(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-card p-4">
      <McpIdentityFields form={form} locked={!!initial} onChange={patch} />
      {form.type === "stdio" ? (
        <McpStdioFields form={form} onChange={patch} />
      ) : (
        <McpSseField url={form.url} onChange={(url) => patch({ url })} />
      )}
      <McpEnvField env={form.env} onChange={(env) => patch({ env })} />
      <FormError error={error} />
      <McpFormActions
        saving={saving}
        canSave={canSave}
        onCancel={onCancel}
        onSave={handleSave}
      />
    </div>
  )
}
