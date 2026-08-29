import { useTranslation } from "react-i18next"
import { Folder, Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { DirListResponse } from "@/lib/api"
import { cn } from "@/lib/utils"

function DirListStatus({
  loading,
  error,
  empty,
}: {
  loading: boolean
  error: string | null
  empty: boolean
}) {
  const { t } = useTranslation()
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex h-64 items-center justify-center px-4">
        <p className="text-center text-xs text-destructive">{error}</p>
      </div>
    )
  }
  if (empty) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-xs text-muted-foreground">
          {t("settings.emptyDir")}
        </p>
      </div>
    )
  }
  return null
}

function DirEntries({
  entries,
  current,
  onGo,
  onChoose,
}: {
  entries: { name: string; path: string }[]
  current: string
  onGo: (path: string) => void
  onChoose: (path: string) => void
}) {
  return (
    <div className="divide-y divide-border">
      {entries.map((entry) => {
        const active = entry.path === current
        return (
          <button
            key={entry.path}
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/60",
              active && "bg-primary/10"
            )}
            onClick={() => onGo(entry.path)}
            onDoubleClick={() => onChoose(entry.path)}
          >
            <Folder
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                active ? "text-primary" : "text-primary/70"
              )}
            />
            <span className="truncate font-mono text-foreground">
              {entry.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function DirEntryList({
  data,
  current,
  loading,
  error,
  onGo,
  onChoose,
}: {
  data: DirListResponse | null
  current: string
  loading: boolean
  error: string | null
  onGo: (path: string) => void
  onChoose: (path: string) => void
}) {
  const empty = !data || data.entries.length === 0
  const showEntries = !loading && !error && !empty && data
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <ScrollArea className="h-64">
        {showEntries ? (
          <DirEntries
            entries={data.entries}
            current={current}
            onGo={onGo}
            onChoose={onChoose}
          />
        ) : (
          <DirListStatus loading={loading} error={error} empty={empty} />
        )}
      </ScrollArea>
    </div>
  )
}
