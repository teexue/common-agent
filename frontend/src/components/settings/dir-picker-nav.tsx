import { useTranslation } from "react-i18next"
import { ChevronRight, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isComposingEvent } from "@/lib/keys"

export function DirPathInput({
  pathInput,
  loading,
  onPathInputChange,
  onGo,
}: {
  pathInput: string
  loading: boolean
  onPathInputChange: (v: string) => void
  onGo: (path: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-2">
      <Input
        value={pathInput}
        onChange={(e) => onPathInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (isComposingEvent(e)) return
          if (e.key === "Enter") onGo(pathInput.trim())
        }}
        className="h-9 flex-1 rounded-lg font-mono text-xs"
        placeholder="/"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-9 shrink-0 text-xs"
        onClick={() => onGo(pathInput.trim())}
        disabled={loading}
      >
        {t("settings.go")}
      </Button>
    </div>
  )
}

export function DirBreadcrumbs({
  crumbs,
  loading,
  onGo,
}: {
  crumbs: { label: string; path: string }[]
  loading: boolean
  onGo: (path: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 text-[11px]">
      <button
        type="button"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        disabled={loading}
        onClick={() => onGo("")}
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
            onClick={() => onGo(c.path)}
            title={c.path}
          >
            {c.label}
          </button>
        </span>
      ))}
    </div>
  )
}
