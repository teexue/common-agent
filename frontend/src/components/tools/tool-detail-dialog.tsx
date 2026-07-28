import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { JsonViewer } from "@/components/artifact/json-viewer"
import { Wrench } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toolDisplayDescription, toolDisplayName } from "@/lib/tool-i18n"
import type { ToolInfo } from "@/types/agent"

interface ToolDetailDialogProps {
  tool: ToolInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ToolDetailDialog({
  tool,
  open,
  onOpenChange,
}: ToolDetailDialogProps) {
  const { t } = useTranslation()
  if (!tool) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-sm tracking-tight">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted">
              <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span>{toolDisplayName(tool.name, t)}</span>
            <Badge
              variant="secondary"
              className="rounded-md px-1.5 py-0 text-[10px]"
            >
              {t("tools.badge")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="font-mono text-[10px] text-muted-foreground">
            {t("tools.id")}: {tool.name}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {toolDisplayDescription(tool.name, tool.description, t)}
          </p>

          <Separator />

          <div>
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("tools.paramSchema")}
            </h4>
            <JsonViewer data={tool.parameters} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
