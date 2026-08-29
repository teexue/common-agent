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

interface SessionWorkdirProps {
  workDir: string
  sessionScoped: boolean
  onPick: (dir: string) => void
  onClear: () => void
}

const HISTORY_KEY = "workdir-history"
const HISTORY_MAX = 8

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : []
  } catch {
    return []
  }
}

function pushHistory(dir: string): string[] {
  const next = [dir, ...loadHistory().filter((d) => d !== dir)].slice(
    0,
    HISTORY_MAX
  )
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  return next
}

function basename(path: string): string {
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/)
  return parts[parts.length - 1] || path
}

/** Per-session working directory selector rendered at the input bar's bottom
 * left. Remembers previously chosen directories; the directory browser only
 * opens when adding a new one. */
export function SessionWorkdir({
  workDir,
  sessionScoped,
  onPick,
  onClear,
}: SessionWorkdirProps) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [history, setHistory] = useState<string[]>(loadHistory)
  const handlePick = (dir: string) => {
    setHistory(pushHistory(dir))
    onPick(dir)
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 rounded-md px-1.5 text-muted-foreground hover:text-foreground"
              title={workDir || t("conversation.workdirDefaultHint")}
            />
          }
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="max-w-28 truncate font-mono text-[11px]">
            {workDir ? basename(workDir) : t("conversation.workdirDefault")}
          </span>
        </DropdownMenuTrigger>
        <WorkdirMenu
          history={history}
          workDir={workDir}
          sessionScoped={sessionScoped}
          onPick={handlePick}
          onAdd={() => setPickerOpen(true)}
          onClear={onClear}
        />
      </DropdownMenu>
      <DirPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialPath={workDir}
        onSelect={handlePick}
      />
    </>
  )
}

function WorkdirMenu({
  history,
  workDir,
  sessionScoped,
  onPick,
  onAdd,
  onClear,
}: {
  history: string[]
  workDir: string
  sessionScoped: boolean
  onPick: (dir: string) => void
  onAdd: () => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenuContent align="start" className="w-64 rounded-xl">
      {history.map((dir) => (
        <DropdownMenuItem
          key={dir}
          onClick={() => onPick(dir)}
          className="gap-2 text-xs"
        >
          {dir === workDir ? (
            <Check className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate font-mono">{dir}</span>
        </DropdownMenuItem>
      ))}
      {history.length > 0 && <DropdownMenuSeparator />}
      <DropdownMenuItem onClick={onAdd} className="gap-2 text-xs">
        <FolderPlus className="h-3.5 w-3.5" /> {t("conversation.workdirAdd")}
      </DropdownMenuItem>
      {sessionScoped && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onClear} className="gap-2 text-xs">
            <X className="h-3.5 w-3.5" /> {t("conversation.workdirUseGlobal")}
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  )
}
