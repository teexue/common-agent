import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fetchDirList, createDir, type DirListResponse } from "@/lib/api"
import { DirToolbar } from "./dir-picker-nav"
import { DirEntryList } from "./dir-picker-list"
import { basename } from "./dir-picker-path"
import { errMessage } from "./select-value"
import { cn } from "@/lib/utils"

interface DirPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPath?: string
  recents?: string[]
  onSelect: (path: string) => void
  onReset?: () => void
}

export function DirPickerDialog({
  open,
  onOpenChange,
  initialPath,
  recents,
  onSelect,
  onReset,
}: DirPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DirPickerBody
          key={initialPath || ""}
          initialPath={initialPath}
          recents={recents ?? []}
          onSelect={onSelect}
          onClose={() => onOpenChange(false)}
          onReset={onReset}
        />
      ) : null}
    </Dialog>
  )
}

function DirPickerBody({
  initialPath,
  recents,
  onSelect,
  onClose,
  onReset,
}: {
  initialPath?: string
  recents: string[]
  onSelect: (path: string) => void
  onClose: () => void
  onReset?: () => void
}) {
  const state = useDirPickerState(initialPath)
  const target = state.highlighted || state.current
  const choose = (path: string) => {
    if (!path) return
    onSelect(path)
    onClose()
  }
  return (
    <DialogContent className="gap-3 rounded-2xl p-4 sm:max-w-xl">
      <DirPickerHeader />
      <DirPickerChrome recents={recents} state={state} />
      <DirPickerFooter
        path={target}
        onReset={
          onReset
            ? () => {
                onReset()
                onClose()
              }
            : undefined
        }
        onConfirm={() => choose(target)}
      />
    </DialogContent>
  )
}

function DirPickerChrome({
  recents,
  state,
}: {
  recents: string[]
  state: ReturnType<typeof useDirPickerState>
}) {
  return (
    <>
      <DirToolbar
        pathInput={state.pathInput}
        loading={state.loading}
        canUp={Boolean(state.parent)}
        canCreate={Boolean(state.current)}
        onPathInputChange={state.setPathInput}
        onGo={state.goTo}
        onUp={() => state.goTo(state.parent)}
        onHome={() => state.goTo("")}
        onNewFolder={() => state.beginCreate()}
      />
      <DirPickerPane
        recents={recents}
        current={state.current}
        data={state.data}
        highlighted={state.highlighted}
        loading={state.loading}
        error={state.error}
        creating={state.creating}
        onGo={state.goTo}
        onHighlight={state.setHighlighted}
        onSubmitCreate={state.mkdir}
        onCancelCreate={() => state.setCreating(false)}
      />
    </>
  )
}

function DirPickerHeader() {
  const { t } = useTranslation()
  return (
    <DialogHeader>
      <DialogTitle className="text-sm">
        {t("settings.browseDirTitle")}
      </DialogTitle>
      <DialogDescription className="sr-only">
        {t("settings.browseDirDesc")}
      </DialogDescription>
    </DialogHeader>
  )
}

function DirPickerPane({
  recents,
  current,
  data,
  highlighted,
  loading,
  error,
  creating,
  onGo,
  onHighlight,
  onSubmitCreate,
  onCancelCreate,
}: {
  recents: string[]
  current: string
  data: DirListResponse | null
  highlighted: string
  loading: boolean
  error: string | null
  creating: boolean
  onGo: (path: string) => void
  onHighlight: (path: string) => void
  onSubmitCreate: (name: string) => void
  onCancelCreate: () => void
}) {
  return (
    <div className="flex overflow-hidden rounded-xl ring-1 ring-border">
      {recents.length > 0 && (
        <DirRecents recents={recents} current={current} onGo={onGo} />
      )}
      <div className="min-w-0 flex-1">
        <DirEntryList
          data={data}
          highlighted={highlighted}
          loading={loading}
          error={error}
          creating={creating}
          onHighlight={onHighlight}
          onOpen={onGo}
          onSubmitCreate={onSubmitCreate}
          onCancelCreate={onCancelCreate}
        />
      </div>
    </div>
  )
}

function DirRecents({
  recents,
  current,
  onGo,
}: {
  recents: string[]
  current: string
  onGo: (path: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex w-32 shrink-0 flex-col gap-0.5 bg-muted/30 p-1.5">
      <p className="px-1.5 py-1 text-[10px] text-muted-foreground">
        {t("settings.dirRecents")}
      </p>
      {recents.map((dir) => (
        <button
          key={dir}
          type="button"
          title={dir}
          onClick={() => onGo(dir)}
          className={cn(
            "truncate rounded-md px-1.5 py-1 text-left font-mono text-[11px] hover:bg-muted",
            dir === current && "bg-muted text-foreground"
          )}
        >
          {basename(dir)}
        </button>
      ))}
    </div>
  )
}

function DirPickerFooter({
  path,
  onReset,
  onConfirm,
}: {
  path: string
  onReset?: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2">
      <span
        className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground"
        title={path}
      >
        <FolderOpen className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
        {path || "—"}
      </span>
      {onReset && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-[11px]"
          onClick={onReset}
        >
          {t("conversation.workdirReset")}
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        className="h-7 shrink-0 px-2.5 text-[11px]"
        onClick={onConfirm}
        disabled={!path}
      >
        {t("settings.selectDir")}
      </Button>
    </div>
  )
}

function runCreateDir(
  current: string,
  name: string,
  load: (path: string) => Promise<unknown>
) {
  return createDir(current, name).then(() => load(current))
}

function useDirPickerState(initialPath?: string) {
  const [current, setCurrent] = useState("")
  const [highlighted, setHighlighted] = useState("")
  const [pathInput, setPathInput] = useState("")
  const [data, setData] = useState<DirListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const load = useCallback((path: string) => {
    return fetchDirList(path)
      .then((res) => {
        setData(res)
        setCurrent(res.path)
        setPathInput(res.path)
        setHighlighted("")
        setError(null)
      })
      .catch((e: unknown) => {
        setError(errMessage(e))
      })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    void load(initialPath || "")
  }, [load, initialPath])
  const goTo = (path: string) => {
    setCreating(false)
    setLoading(true)
    void load(path)
  }
  const mkdir = (name: string) => {
    setCreating(false)
    if (!name || !current) return
    setLoading(true)
    void runCreateDir(current, name, load).catch((e: unknown) => {
      setError(errMessage(e))
      setLoading(false)
    })
  }
  return {
    current,
    highlighted,
    setHighlighted,
    pathInput,
    setPathInput,
    data,
    loading,
    error,
    goTo,
    parent: data?.parent ?? "",
    creating,
    setCreating,
    beginCreate: () => {
      setError(null)
      setCreating(true)
    },
    mkdir,
  }
}
