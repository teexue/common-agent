import { MousePointerClick } from "lucide-react"
import { useTranslation } from "react-i18next"

export function EmptyInspector() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <MousePointerClick className="h-5 w-5 opacity-60" />
      </div>
      <p className="font-heading text-sm text-foreground">{t("inspector.emptyTitle")}</p>
      <p className="mt-1.5 max-w-[14rem] text-xs leading-relaxed text-muted-foreground">
        {t("inspector.emptyDesc")}
      </p>
      <kbd className="mt-4 rounded-lg border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
        {t("inspector.emptyEsc")}
      </kbd>
    </div>
  )
}
