import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function TextFileDialog({
  name,
  text,
  open,
  onOpenChange,
}: {
  name: string
  text: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="truncate pr-8 font-mono text-sm">
            {name}
          </DialogTitle>
        </DialogHeader>
        <pre className="max-h-[60vh] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-foreground">
          {text || t("conversation.attachedFileEmpty")}
        </pre>
      </DialogContent>
    </Dialog>
  )
}
