import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteProvider, fetchProviders } from "@/lib/api"
import type { ProviderInfo } from "@/types/agent"
import { EmptyState } from "@/components/shared/empty-state"
import { ProviderCard } from "./provider-card"
import { ProviderForm } from "./provider-form"

/** Provider list / create / edit panel for Settings. */
export function ProviderPanel() {
  const { t } = useTranslation()
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    setError(null)
    fetchProviders()
      .then((list) => setProviders(list ?? []))
      .catch((e: unknown) => {
        setProviders([])
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [])

  if (loading) return <EmptyState title={t("settings.loading")} />

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {providers.length === 0 && editing === null && (
        <EmptyState title={t("settings.providersEmpty")} />
      )}
      {providers.map((p) =>
        editing === p.name ? (
          <ProviderForm
            key={p.name}
            provider={p}
            onSaved={() => {
              setEditing(null)
              refresh()
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <ProviderCard
            key={p.name}
            provider={p}
            onEdit={() => setEditing(p.name)}
            onDelete={async () => {
              await deleteProvider(p.name)
              refresh()
            }}
          />
        )
      )}
      {editing === "" && (
        <ProviderForm
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {editing === null && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={() => setEditing("")}
        >
          <Plus className="h-3.5 w-3.5" /> {t("settings.addProvider")}
        </Button>
      )}
    </div>
  )
}
