import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ImageIcon, Keyboard } from "lucide-react"
import { fetchVersion } from "@/lib/api"
import { BackgroundPanel } from "./background-panel"
import { SettingsSection } from "./settings-section"

export function BackgroundSection() {
  const { t } = useTranslation()
  return (
    <SettingsSection
      title={t("settings.background")}
      icon={<ImageIcon className="h-3.5 w-3.5" />}
    >
      <BackgroundPanel />
    </SettingsSection>
  )
}

export function ShortcutsSection() {
  const { t } = useTranslation()
  const shortcuts = [
    [t("settings.shortcutSidebar"), "⌘ Shift S"],
    [t("settings.shortcutClose"), "Esc"],
    [t("settings.shortcutSend"), "Enter"],
    [t("settings.shortcutNewline"), "Shift Enter"],
  ] as const
  return (
    <SettingsSection
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
    </SettingsSection>
  )
}

export function AboutSection() {
  const { t } = useTranslation()
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
  return (
    <SettingsSection title={t("settings.about")}>
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
    </SettingsSection>
  )
}
