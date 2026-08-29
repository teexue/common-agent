import { useTranslation } from "react-i18next"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AgentEditorActions({
  onBack,
  onSave,
  saving,
  loading,
}: {
  onBack: () => void
  onSave: () => void
  saving: boolean
  loading: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={onBack}
      >
        {t("common.cancel")}
      </Button>
      <Button
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={onSave}
        disabled={saving || loading}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {t("common.save")}
      </Button>
    </>
  )
}
