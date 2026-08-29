import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteProvider, fetchProviders } from "@/lib/api"
import type { ProviderInfo } from "@/types/agent"
import { EmptyState } from "@/components/shared/empty-state"
import { FormError } from "./form-error"
import { ProviderCard } from "./provider-card"
import { ProviderForm } from "./provider-form"
import { errMessage } from "./select-value"

function ProviderItems({
  providers,
  editing,
  onEdit,
  onSaved,
  onCancel,
  onDelete,
}: {
  providers: ProviderInfo[]
  editing: string | null
  onEdit: (name: string) => void
  onSaved: () => void
  onCancel: () => void
  onDelete: (name: string) => Promise<void>
}) {
  return (
    <>
      {providers.map((p) =>
        editing === p.name ? (
          <ProviderForm
            key={p.name}
            provider={p}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        ) : (
          <ProviderCard
            key={p.name}
            provider={p}
            onEdit={() => onEdit(p.name)}
            onDelete={() => void onDelete(p.name)}
          />
        )
      )}
    </>
  )
}

function useProviderPanel() {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(
    () =>
      fetchProviders()
        .then((list) => setProviders(list ?? []))
        .catch((e: unknown) => {
          setProviders([])
          setError(errMessage(e))
        }),
    []
  )
  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    void load().finally(() => setLoading(false))
  }, [load])
  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])
  return { providers, loading, editing, setEditing, error, refresh }
}

/** Provider list / create / edit panel for Settings. */
export function ProviderPanel() {
  const { t } = useTranslation()
  const p = useProviderPanel()
  if (p.loading) return <EmptyState title={t("settings.loading")} />
  return (
    <div className="space-y-3">
      <FormError error={p.error} />
      {p.providers.length === 0 && p.editing === null && (
        <EmptyState title={t("settings.providersEmpty")} />
      )}
      <ProviderItems
        providers={p.providers}
        editing={p.editing}
        onEdit={p.setEditing}
        onSaved={() => {
          p.setEditing(null)
          p.refresh()
        }}
        onCancel={() => p.setEditing(null)}
        onDelete={async (name) => {
          await deleteProvider(name)
          p.refresh()
        }}
      />
      {p.editing === "" && (
        <ProviderForm
          onSaved={() => {
            p.setEditing(null)
            p.refresh()
          }}
          onCancel={() => p.setEditing(null)}
        />
      )}
      {p.editing === null && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={() => p.setEditing("")}
        >
          <Plus className="h-3.5 w-3.5" /> {t("settings.addProvider")}
        </Button>
      )}
    </div>
  )
}
