import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fetchDirList, type DirListResponse } from "@/lib/api"
import { DirBreadcrumbs, DirPathInput } from "./dir-picker-nav"
import { DirEntryList } from "./dir-picker-list"
import { breadcrumbs } from "./dir-picker-path"
import { errMessage } from "./select-value"

interface DirPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPath?: string
  onSelect: (path: string) => void
}

export function DirPickerDialog({
  open,
  onOpenChange,
  initialPath,
  onSelect,
}: DirPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DirPickerBody
          key={initialPath || ""}
          initialPath={initialPath}
          onSelect={onSelect}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  )
}

function DirPickerFooter({
  current,
  onClose,
  onConfirm,
}: {
  current: string
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <DialogFooter>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={onClose}
      >
        {t("settings.cancel")}
      </Button>
      <Button
        size="sm"
        className="h-8 text-xs"
        onClick={onConfirm}
        disabled={!current}
      >
        {t("settings.selectDir")}
      </Button>
    </DialogFooter>
  )
}

function DirPickerBody({
  initialPath,
  onSelect,
  onClose,
}: {
  initialPath?: string
  onSelect: (path: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const state = useDirPickerState(initialPath)
  const choose = (path: string) => {
    onSelect(path)
    onClose()
  }
  return (
    <DialogContent className="gap-4 rounded-2xl p-5 sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{t("settings.browseDirTitle")}</DialogTitle>
        <DialogDescription>{t("settings.browseDirDesc")}</DialogDescription>
      </DialogHeader>
      <DirPathInput
        pathInput={state.pathInput}
        loading={state.loading}
        onPathInputChange={state.setPathInput}
        onGo={state.goTo}
      />
      <DirBreadcrumbs
        crumbs={state.crumbs}
        loading={state.loading}
        onGo={state.goTo}
      />
      <DirEntryList
        data={state.data}
        current={state.current}
        loading={state.loading}
        error={state.error}
        onGo={state.goTo}
        onChoose={choose}
      />
      <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {state.current || "—"}
        </span>
      </div>
      <DirPickerFooter
        current={state.current}
        onClose={onClose}
        onConfirm={() => choose(state.current)}
      />
    </DialogContent>
  )
}

function useDirPickerState(initialPath?: string) {
  const [current, setCurrent] = useState("")
  const [pathInput, setPathInput] = useState("")
  const [data, setData] = useState<DirListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback((path: string) => {
    return fetchDirList(path)
      .then((res) => {
        setData(res)
        setCurrent(res.path)
        setPathInput(res.path)
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
    setLoading(true)
    void load(path)
  }
  return {
    current,
    pathInput,
    setPathInput,
    data,
    loading,
    error,
    goTo,
    crumbs: breadcrumbs(current),
  }
}
