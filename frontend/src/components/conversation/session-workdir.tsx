import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DirPickerDialog } from "@/components/settings/dir-picker-dialog"
import {
  basename,
  loadWorkdirHistory,
  pushWorkdirHistory,
} from "@/components/settings/dir-picker-path"

interface SessionWorkdirProps {
  workDir: string
  sessionScoped: boolean
  onPick: (dir: string) => void
  onClear: () => void
}

const chipBtn =
  "h-6 min-w-0 max-w-full shrink justify-start gap-1 overflow-hidden rounded-md px-1.5 text-muted-foreground hover:text-foreground"

/** Per-session working directory. Opens a file-manager picker. */
export function SessionWorkdir({
  workDir,
  sessionScoped,
  onPick,
  onClear,
}: SessionWorkdirProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<string[]>(loadWorkdirHistory)
  const handlePick = (dir: string) => {
    setHistory(pushWorkdirHistory(dir))
    onPick(dir)
  }
  return (
    <div className="max-w-full min-w-0 overflow-hidden">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={chipBtn}
        title={workDir || t("conversation.workdirDefaultHint")}
        onClick={() => setOpen(true)}
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate font-mono text-[11px]">
          {workDir ? basename(workDir) : t("conversation.workdirDefault")}
        </span>
      </Button>
      <DirPickerDialog
        open={open}
        onOpenChange={setOpen}
        initialPath={workDir}
        recents={history}
        onSelect={handlePick}
        onReset={sessionScoped ? onClear : undefined}
      />
    </div>
  )
}
