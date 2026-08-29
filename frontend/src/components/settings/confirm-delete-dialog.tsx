import { useTranslation } from "react-i18next"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function ConfirmDeleteDialog({
  open,
  title,
  message,
  error,
  deleting,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  message: string
  error: string | null
  deleting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="border-border bg-card sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Trash2 className="h-4 w-4 text-destructive" /> {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{message}</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={onClose}
            disabled={deleting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 text-xs"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? t("common.loading") : t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
