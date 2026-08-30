import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Folder, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { isComposingEvent } from "@/lib/keys"
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
      <div className="flex h-52 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex h-52 items-center justify-center px-3">
        <p className="text-center text-[11px] text-destructive">{error}</p>
      </div>
    )
  }
  if (empty) {
    return (
      <div className="flex h-52 items-center justify-center">
        <p className="text-[11px] text-muted-foreground">
          {t("settings.emptyDir")}
        </p>
      </div>
    )
  }
  return null
}

function DirEntries({
  entries,
  highlighted,
  creating,
  onHighlight,
  onOpen,
  onSubmitCreate,
  onCancelCreate,
}: {
  entries: { name: string; path: string }[]
  highlighted: string
  creating: boolean
  onHighlight: (path: string) => void
  onOpen: (path: string) => void
  onSubmitCreate: (name: string) => void
  onCancelCreate: () => void
}) {
  return (
    <div className="p-0.5">
      {creating && (
        <DirNewFolderRow onSubmit={onSubmitCreate} onCancel={onCancelCreate} />
      )}
      {entries.map((entry) => {
        const active = entry.path === highlighted
        return (
          <button
            key={entry.path}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] transition-colors hover:bg-muted/70",
              active && "bg-muted text-foreground"
            )}
            onClick={() => onHighlight(entry.path)}
            onDoubleClick={() => onOpen(entry.path)}
          >
            <Folder
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                active ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span className="truncate font-mono">{entry.name}</span>
          </button>
        )
      })}
    </div>
  )
}

function DirNewFolderRow({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(t("settings.newDirDefault"))
  const done = useRef(false)
  const commit = () => {
    if (done.current) return
    done.current = true
    const next = name.trim()
    if (next) onSubmit(next)
    else onCancel()
  }
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/70 px-2 py-1">
      <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (isComposingEvent(e)) return
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          }
          if (e.key === "Escape") {
            e.preventDefault()
            done.current = true
            onCancel()
          }
        }}
        className="h-6 rounded-md px-1.5 font-mono text-[11px]"
      />
    </div>
  )
}

export function DirEntryList({
  data,
  highlighted,
  loading,
  error,
  creating,
  onHighlight,
  onOpen,
  onSubmitCreate,
  onCancelCreate,
}: {
  data: DirListResponse | null
  highlighted: string
  loading: boolean
  error: string | null
  creating: boolean
  onHighlight: (path: string) => void
  onOpen: (path: string) => void
  onSubmitCreate: (name: string) => void
  onCancelCreate: () => void
}) {
  const empty = !data || data.entries.length === 0
  const showEntries = !loading && !!data && (!empty || creating)
  return (
    <ScrollArea className="h-52">
      {error && data ? (
        <p className="px-2 py-1 text-[11px] text-destructive">{error}</p>
      ) : null}
      {showEntries ? (
        <DirEntries
          entries={data?.entries ?? []}
          highlighted={highlighted}
          creating={creating}
          onHighlight={onHighlight}
          onOpen={onOpen}
          onSubmitCreate={onSubmitCreate}
          onCancelCreate={onCancelCreate}
        />
      ) : (
        <DirListStatus loading={loading} error={error} empty={empty} />
      )}
    </ScrollArea>
  )
}
