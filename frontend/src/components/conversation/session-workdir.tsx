import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, FolderOpen, FolderPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DirPickerDialog } from "@/components/settings/dir-picker-dialog"
import {
  basename,
  clearWorkdirHistory,
  loadWorkdirHistory,
  pushWorkdirHistory,
  removeWorkdirHistory,
} from "@/components/settings/dir-picker-path"

interface SessionWorkdirProps {
  workDir: string
  sessionScoped: boolean
  onPick: (dir: string) => void
  onClear: () => void
}

const chipBtn =
  "h-6 min-w-0 max-w-full shrink justify-start gap-1 overflow-hidden rounded-md px-1.5 text-muted-foreground hover:text-foreground"

/** Per-session working directory: recents menu, then file-manager picker. */
export function SessionWorkdir({
  workDir,
  sessionScoped,
  onPick,
  onClear,
}: SessionWorkdirProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [history, setHistory] = useState<string[]>(loadWorkdirHistory)
  const handlePick = (dir: string) => {
    setHistory(pushWorkdirHistory(dir))
    onPick(dir)
  }
  return (
    <div className="max-w-full min-w-0 overflow-hidden">
      <WorkdirMenu
        workDir={workDir}
        history={history}
        sessionScoped={sessionScoped}
        onRefresh={() => setHistory(loadWorkdirHistory())}
        onPick={handlePick}
        onRemove={(dir) => setHistory(removeWorkdirHistory(dir))}
        onClearRecents={() => setHistory(clearWorkdirHistory())}
        onBrowse={() => setPickerOpen(true)}
        onClear={onClear}
      />
      <DirPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialPath={workDir}
        recents={history}
        onSelect={handlePick}
        onReset={sessionScoped ? onClear : undefined}
      />
    </div>
  )
}

function WorkdirMenu({
  workDir,
  history,
  sessionScoped,
  onRefresh,
  onPick,
  onRemove,
  onClearRecents,
  onBrowse,
  onClear,
}: {
  workDir: string
  history: string[]
  sessionScoped: boolean
  onRefresh: () => void
  onPick: (dir: string) => void
  onRemove: (dir: string) => void
  onClearRecents: () => void
  onBrowse: () => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) onRefresh()
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={chipBtn}
            title={workDir || t("conversation.workdirDefaultHint")}
          />
        }
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate font-mono text-[11px]">
          {workDir ? basename(workDir) : t("conversation.workdirDefault")}
        </span>
      </DropdownMenuTrigger>
      <WorkdirMenuContent
        history={history}
        workDir={workDir}
        sessionScoped={sessionScoped}
        onPick={onPick}
        onRemove={onRemove}
        onClearRecents={onClearRecents}
        onBrowse={onBrowse}
        onClear={onClear}
      />
    </DropdownMenu>
  )
}

function WorkdirMenuContent({
  history,
  workDir,
  sessionScoped,
  onPick,
  onRemove,
  onClearRecents,
  onBrowse,
  onClear,
}: {
  history: string[]
  workDir: string
  sessionScoped: boolean
  onPick: (dir: string) => void
  onRemove: (dir: string) => void
  onClearRecents: () => void
  onBrowse: () => void
  onClear: () => void
}) {
  return (
    <DropdownMenuContent
      side="top"
      align="start"
      className="w-max min-w-52 rounded-xl"
    >
      {history.map((dir) => (
        <WorkdirRecentRow
          key={dir}
          dir={dir}
          selected={dir === workDir}
          onPick={onPick}
          onRemove={onRemove}
        />
      ))}
      <WorkdirMenuActions
        hasRecents={history.length > 0}
        sessionScoped={sessionScoped}
        onClearRecents={onClearRecents}
        onBrowse={onBrowse}
        onClear={onClear}
      />
    </DropdownMenuContent>
  )
}

function WorkdirMenuActions({
  hasRecents,
  sessionScoped,
  onClearRecents,
  onBrowse,
  onClear,
}: {
  hasRecents: boolean
  sessionScoped: boolean
  onClearRecents: () => void
  onBrowse: () => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {hasRecents ? (
        <DropdownMenuItem
          onClick={onClearRecents}
          className="text-xs font-normal text-muted-foreground"
        >
          {t("conversation.workdirClearRecents")}
        </DropdownMenuItem>
      ) : null}
      {hasRecents ? <DropdownMenuSeparator /> : null}
      <DropdownMenuItem
        onClick={onBrowse}
        className="gap-2 text-xs font-normal"
      >
        <FolderPlus className="h-3.5 w-3.5 shrink-0" />
        {t("conversation.workdirAdd")}
      </DropdownMenuItem>
      {sessionScoped ? (
        <DropdownMenuItem
          onClick={onClear}
          className="gap-2 text-xs font-normal"
        >
          {t("conversation.workdirReset")}
        </DropdownMenuItem>
      ) : null}
    </>
  )
}

function WorkdirRecentRow({
  dir,
  selected,
  onPick,
  onRemove,
}: {
  dir: string
  selected: boolean
  onPick: (dir: string) => void
  onRemove: (dir: string) => void
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenuItem
      onClick={() => onPick(dir)}
      className="gap-2 pr-1 text-xs font-normal"
    >
      {selected ? (
        <Check className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <span className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate font-mono" title={dir}>
        {basename(dir)}
      </span>
      <span
        role="button"
        tabIndex={-1}
        title={t("conversation.workdirForget")}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onRemove(dir)
        }}
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <X className="h-3 w-3" />
      </span>
    </DropdownMenuItem>
  )
}
