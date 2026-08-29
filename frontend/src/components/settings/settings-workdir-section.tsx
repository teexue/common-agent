import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DirPickerDialog } from "./dir-picker-dialog"
import { SettingsSection } from "./settings-section"

export function WorkDirSection() {
  const { t } = useTranslation()
  const [workDir, setWorkDir] = useState(
    () => localStorage.getItem("workDir") || ""
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const handleWorkDirChange = (value: string) => {
    setWorkDir(value)
    localStorage.setItem("workDir", value)
  }
  return (
    <SettingsSection
      title={t("settings.workDir")}
      icon={<FolderOpen className="h-3.5 w-3.5" />}
    >
      <div className="flex gap-2">
        <Input
          value={workDir}
          onChange={(e) => handleWorkDirChange(e.target.value)}
          placeholder={t("settings.workDirPlaceholder")}
          className="rounded-xl font-mono text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5 text-xs"
          onClick={() => setPickerOpen(true)}
        >
          <FolderOpen className="h-3.5 w-3.5" /> {t("settings.browse")}
        </Button>
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
        {t("settings.workDirHint")}
      </p>
      <DirPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialPath={workDir}
        onSelect={handleWorkDirChange}
      />
    </SettingsSection>
  )
}
