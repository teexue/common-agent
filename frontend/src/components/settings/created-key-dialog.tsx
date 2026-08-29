import { useTranslation } from "react-i18next"
import { TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CopyButton } from "@/components/shared/copy-button"
import type { CreatedAuthKey } from "@/lib/api"

/** Shows the raw key exactly once after creation. */
export function CreatedKeyDialog({
  created,
  onClose,
}: {
  created: CreatedAuthKey | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={!!created} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 rounded-2xl p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.apiKeyCreatedTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <code className="min-w-0 flex-1 font-mono text-xs break-all text-foreground select-all">
            {created?.key}
          </code>
          {created && <CopyButton text={created.key} />}
        </div>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-warning">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("settings.apiKeyCreatedHint")}
        </p>
        <DialogFooter>
          <Button size="sm" className="h-8 text-xs" onClick={onClose}>
            {t("settings.apiKeyDismiss")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
