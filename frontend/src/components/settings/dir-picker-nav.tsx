import { useTranslation } from "react-i18next"
import { ArrowUp, FolderPlus, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isComposingEvent } from "@/lib/keys"

const iconBtn =
  "h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"

export function DirToolbar({
  pathInput,
  loading,
  canUp,
  canCreate,
  onPathInputChange,
  onGo,
  onUp,
  onHome,
  onNewFolder,
}: {
  pathInput: string
  loading: boolean
  canUp: boolean
  canCreate: boolean
  onPathInputChange: (v: string) => void
  onGo: (path: string) => void
  onUp: () => void
  onHome: () => void
  onNewFolder: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <DirNavButtons
        loading={loading}
        canUp={canUp}
        canCreate={canCreate}
        onUp={onUp}
        onHome={onHome}
        onNewFolder={onNewFolder}
      />
      <Input
        value={pathInput}
        onChange={(e) => onPathInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (isComposingEvent(e)) return
          if (e.key === "Enter") onGo(pathInput.trim())
        }}
        className="h-7 flex-1 rounded-md px-2 font-mono text-[11px]"
        placeholder="/"
        disabled={loading}
      />
    </div>
  )
}

function DirNavButtons({
  loading,
  canUp,
  canCreate,
  onUp,
  onHome,
  onNewFolder,
}: {
  loading: boolean
  canUp: boolean
  canCreate: boolean
  onUp: () => void
  onHome: () => void
  onNewFolder: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={iconBtn}
        disabled={loading || !canUp}
        onClick={onUp}
        title={t("settings.parentDir")}
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={iconBtn}
        disabled={loading}
        onClick={onHome}
        title={t("settings.homeDir")}
      >
        <Home className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={iconBtn}
        disabled={loading || !canCreate}
        onClick={onNewFolder}
        title={t("settings.newDir")}
      >
        <FolderPlus className="h-3.5 w-3.5" />
      </Button>
    </>
  )
}
