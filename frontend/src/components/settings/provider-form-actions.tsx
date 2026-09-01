import { useTranslation } from "react-i18next"
import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"

export function VisionToggle({
  vision,
  onToggle,
}: {
  vision: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${vision ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
      >
        <Eye className="h-3.5 w-3.5" /> {t("settings.providerVision")}
      </button>
      <p className="text-[11px] text-muted-foreground">
        {t("settings.providerVisionHint")}
      </p>
    </div>
  )
}

export function FormActions({
  saving,
  canSave,
  onCancel,
  onSave,
}: {
  saving: boolean
  canSave: boolean
  onCancel: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-4 text-xs"
        onClick={onCancel}
      >
        {t("settings.cancel")}
      </Button>
      <Button
        size="sm"
        className="h-8 gap-1.5 px-4 text-xs"
        onClick={onSave}
        disabled={saving || !canSave}
      >
        {saving ? t("settings.loading") : t("settings.save")}
      </Button>
    </div>
  )
}
