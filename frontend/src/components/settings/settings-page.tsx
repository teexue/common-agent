import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import i18n from "@/i18n"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FolderOpen, ImageIcon, Keyboard, Settings } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { Input } from "@/components/ui/input"
import { fetchVersion } from "@/lib/api"
import { DirPickerDialog } from "@/components/settings/dir-picker-dialog"
import { BackgroundPanel } from "@/components/settings/background-panel"

/** Personal preference settings: appearance, language, workspace, background, shortcuts, about. */
export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <PageShell>
      <PageHeader
        icon={Settings}
        title={t("settings.title")}
      />

      <PageMain contentClassName="w-full space-y-6">
        <GeneralTab />
      </PageMain>
    </PageShell>
  )
}

function GeneralTab() {
  const { t, i18n: i18nInstance } = useTranslation()
  const { theme, setTheme, palette, setPalette } = useTheme()
  const [workDir, setWorkDir] = useState(
    () => localStorage.getItem("workDir") || ""
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [appVersion, setAppVersion] = useState("")

  useEffect(() => {
    let cancelled = false
    fetchVersion().then((v) => {
      if (!cancelled) setAppVersion(v)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const themeOptions = [
    { value: "light", label: t("settings.themeLight") },
    { value: "dark", label: t("settings.themeDark") },
    { value: "system", label: t("settings.themeSystem") },
  ]

  const paletteOptions = [
    { value: "warm", label: t("settings.paletteWarm") },
    { value: "slate", label: t("settings.paletteSlate") },
  ]

  const langOptions = [
    { value: "zh-CN", label: t("settings.langZh") },
    { value: "en", label: t("settings.langEn") },
  ]

  const currentLang = i18nInstance.language?.startsWith("zh") ? "zh-CN" : "en"

  const shortcuts = [
    [t("settings.shortcutSidebar"), "⌘ Shift S"],
    [t("settings.shortcutClose"), "Esc"],
    [t("settings.shortcutSend"), "Enter"],
    [t("settings.shortcutNewline"), "Shift Enter"],
  ] as const

  const handleWorkDirChange = (value: string) => {
    setWorkDir(value)
    localStorage.setItem("workDir", value)
  }

  return (
    <>
      <Section title={t("settings.palette")}>
        <Select
          value={{
            value: palette,
            label:
              paletteOptions.find((o) => o.value === palette)?.label ?? palette,
          }}
          onValueChange={(v) => {
            if (v && typeof v === "object" && "value" in v)
              setPalette((v as { value: string }).value as "warm" | "slate")
          }}
        >
          <SelectTrigger className="w-full rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {paletteOptions.map((o) => (
              <SelectItem
                key={o.value}
                value={{ value: o.value, label: o.label }}
              >
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>

      <Section title={t("settings.appearance")}>
        <Select
          value={{
            value: theme,
            label: themeOptions.find((o) => o.value === theme)?.label ?? theme,
          }}
          onValueChange={(v) => {
            if (v && typeof v === "object" && "value" in v)
              setTheme(
                (v as { value: string }).value as "dark" | "light" | "system"
              )
          }}
        >
          <SelectTrigger className="w-full rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {themeOptions.map((o) => (
              <SelectItem
                key={o.value}
                value={{ value: o.value, label: o.label }}
              >
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>

      <Section title={t("settings.language")}>
        <Select
          value={{
            value: currentLang,
            label:
              langOptions.find((o) => o.value === currentLang)?.label ??
              currentLang,
          }}
          onValueChange={(v) => {
            if (v && typeof v === "object" && "value" in v) {
              void i18n.changeLanguage((v as { value: string }).value)
            }
          }}
        >
          <SelectTrigger className="w-full rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {langOptions.map((o) => (
              <SelectItem
                key={o.value}
                value={{ value: o.value, label: o.label }}
              >
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>

      <Section
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
      </Section>

      <Section
        title={t("settings.background")}
        icon={<ImageIcon className="h-3.5 w-3.5" />}
      >
        <BackgroundPanel />
      </Section>

      <Section
        title={t("settings.shortcuts")}
        icon={<Keyboard className="h-3.5 w-3.5" />}
      >
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {shortcuts.map(([label, key]) => (
            <div
              key={label}
              className="flex items-center justify-between px-3 py-2 text-xs"
            >
              <span className="text-foreground">{label}</span>
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("settings.about")}>
        <a
          href="https://github.com/teexue/common-agent"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl border border-border bg-muted/30 px-3.5 py-3 transition-colors hover:border-primary/30 hover:bg-muted/50"
        >
          <p className="font-mono text-xs font-medium text-foreground">
            common-agent {appVersion || "dev"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("settings.aboutDesc")}
          </p>
        </a>
      </Section>
    </>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}
