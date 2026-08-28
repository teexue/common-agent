import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRight, Folder, FolderOpen, Home, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { fetchDirList, type DirListResponse } from "@/lib/api"
import { isComposingEvent } from "@/lib/keys"
import { cn } from "@/lib/utils"

interface DirPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPath?: string
  onSelect: (path: string) => void
}

/** Splits an absolute path into clickable breadcrumb segments. */
function breadcrumbs(path: string): { label: string; path: string }[] {
  if (!path) return []
  const parts = path.split("/").filter(Boolean)
  const crumbs: { label: string; path: string }[] = []
  let acc = ""
  for (const p of parts) {
    acc += "/" + p
    crumbs.push({ label: p, path: acc })
  }
  return crumbs
}

export function DirPickerDialog({
  open,
  onOpenChange,
  initialPath,
  onSelect,
}: DirPickerDialogProps) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState("")
  const [pathInput, setPathInput] = useState("")
  const [data, setData] = useState<DirListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchDirList(path)
      setData(res)
      setCurrent(res.path)
      setPathInput(res.path)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void load(initialPath || "")
  }, [open, initialPath, load])

  const handleConfirm = () => {
    onSelect(current)
    onOpenChange(false)
  }

  const crumbs = breadcrumbs(current)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 rounded-2xl p-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settings.browseDirTitle")}</DialogTitle>
          <DialogDescription>{t("settings.browseDirDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => {
              if (isComposingEvent(e)) return
              if (e.key === "Enter") void load(pathInput.trim())
            }}
            className="h-9 flex-1 rounded-lg font-mono text-xs"
            placeholder="/"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 text-xs"
            onClick={() => void load(pathInput.trim())}
            disabled={loading}
          >
            {t("settings.go")}
          </Button>
        </div>

        {/* Breadcrumb navigation: click any segment to jump. */}
        <div className="flex flex-wrap items-center gap-0.5 text-[11px]">
          <button
            type="button"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            disabled={loading}
            onClick={() => void load("")}
          >
            <Home className="h-3 w-3" />
          </button>
          {crumbs.map((c) => (
            <span key={c.path} className="flex items-center">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <button
                type="button"
                className="max-w-[10rem] truncate rounded px-1.5 py-0.5 font-mono text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                disabled={loading}
                onClick={() => void load(c.path)}
                title={c.path}
              >
                {c.label}
              </button>
            </span>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <ScrollArea className="h-64">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex h-64 items-center justify-center px-4">
                <p className="text-center text-xs text-destructive">{error}</p>
              </div>
            ) : !data || data.entries.length === 0 ? (
              <div className="flex h-64 items-center justify-center">
                <p className="text-xs text-muted-foreground">
                  {t("settings.emptyDir")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.entries.map((entry) => {
                  const active = entry.path === current
                  return (
                    <button
                      key={entry.path}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/60",
                        active && "bg-primary/10"
                      )}
                      onClick={() => void load(entry.path)}
                      onDoubleClick={() => {
                        onSelect(entry.path)
                        onOpenChange(false)
                      }}
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
            )}
          </ScrollArea>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {current || "—"}
          </span>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onOpenChange(false)}
          >
            {t("settings.cancel")}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleConfirm}
            disabled={!current}
          >
            {t("settings.selectDir")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
