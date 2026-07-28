import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Brain, FolderOpen, ImageIcon, Keyboard, KeyRound, Monitor, Plug, Server, Settings } from "lucide-react"
import { Input } from "@/components/ui/input"
import { MetricsPanel } from "@/components/monitoring/metrics-panel"
import { ApiKeysPanel } from "@/components/settings/api-keys-panel"
import { BackgroundPanel } from "@/components/settings/background-panel"
import { DirPickerDialog } from "@/components/settings/dir-picker-dialog"
import { EmbeddingPanel } from "@/components/settings/embedding-panel"
import { McpPanel } from "@/components/settings/mcp-panel"
import { ProviderPanel } from "@/components/settings/provider-panel"

export function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "general"

  const tabTriggers = [
    { value: "general", icon: Settings, label: t("settings.tabGeneral") },
    { value: "monitoring", icon: Monitor, label: t("settings.tabMonitoring") },
    { value: "providers", icon: Server, label: t("settings.tabProviders") },
    { value: "embedding", icon: Brain, label: t("settings.tabEmbedding") },
    { value: "mcp", icon: Plug, label: t("settings.tabMcp") },
    { value: "security", icon: KeyRound, label: t("settings.tabSecurity") },
  ] as const

  const handleTabChange = (value: string) => {
    setSearchParams(value === "general" ? {} : { tab: value })
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon-xs" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <h1 className="font-heading text-base tracking-tight text-foreground">{t("settings.title")}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="w-full px-6 py-6">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full rounded-xl bg-muted p-0.5 mb-6">
              {tabTriggers.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="flex-1 rounded-lg text-xs">
                  <tab.icon className="mr-1 h-3 w-3" /> {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="general" className="mt-0 space-y-6">
              <GeneralTab />
            </TabsContent>
            <TabsContent value="monitoring" className="mt-0 space-y-4">
              <Section title={t("settings.runtimeMetrics")} icon={<Monitor className="h-3.5 w-3.5" />}>
                <MetricsPanel />
              </Section>
            </TabsContent>
            <TabsContent value="providers" className="mt-0 space-y-4">
              <Section title={t("settings.providers")} icon={<Server className="h-3.5 w-3.5" />}>
                <ProviderPanel />
              </Section>
            </TabsContent>
            <TabsContent value="embedding" className="mt-0 space-y-4">
              <Section title={t("settings.embedding")} icon={<Brain className="h-3.5 w-3.5" />}>
                <EmbeddingPanel />
              </Section>
            </TabsContent>
            <TabsContent value="mcp" className="mt-0 space-y-4">
              <Section title={t("settings.mcpServers")} icon={<Plug className="h-3.5 w-3.5" />}>
                <McpPanel />
              </Section>
            </TabsContent>
            <TabsContent value="security" className="mt-0 space-y-4">
              <Section title={t("settings.apiKeys")} icon={<KeyRound className="h-3.5 w-3.5" />}>
                <ApiKeysPanel />
              </Section>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

function GeneralTab() {
  const { t, i18n: i18nInstance } = useTranslation()
  const { theme, setTheme, palette, setPalette } = useTheme()
  const [workDir, setWorkDir] = useState(() => localStorage.getItem("workDir") || "")
  const [pickerOpen, setPickerOpen] = useState(false)

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
          value={{ value: palette, label: paletteOptions.find((o) => o.value === palette)?.label ?? palette }}
          onValueChange={(v) => { if (v && typeof v === "object" && "value" in v) setPalette((v as { value: string }).value as "warm" | "slate") }}
        >
          <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            {paletteOptions.map((o) => <SelectItem key={o.value} value={{ value: o.value, label: o.label }}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Section>

      <Section title={t("settings.appearance")}>
        <Select
          value={{ value: theme, label: themeOptions.find((o) => o.value === theme)?.label ?? theme }}
          onValueChange={(v) => { if (v && typeof v === "object" && "value" in v) setTheme((v as { value: string }).value as "dark" | "light" | "system") }}
        >
          <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            {themeOptions.map((o) => <SelectItem key={o.value} value={{ value: o.value, label: o.label }}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Section>

      <Section title={t("settings.language")}>
        <Select
          value={{ value: currentLang, label: langOptions.find((o) => o.value === currentLang)?.label ?? currentLang }}
          onValueChange={(v) => {
            if (v && typeof v === "object" && "value" in v) {
              void i18n.changeLanguage((v as { value: string }).value)
            }
          }}
        >
          <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            {langOptions.map((o) => <SelectItem key={o.value} value={{ value: o.value, label: o.label }}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Section>

      <Section title={t("settings.workDir")} icon={<FolderOpen className="h-3.5 w-3.5" />}>
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
            className="h-9 shrink-0 gap-1.5 rounded-xl text-xs"
            onClick={() => setPickerOpen(true)}
          >
            <FolderOpen className="h-3.5 w-3.5" /> {t("settings.browse")}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed mt-1.5">{t("settings.workDirHint")}</p>
        <DirPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          initialPath={workDir}
          onSelect={handleWorkDirChange}
        />
      </Section>

      <Section title={t("settings.background")} icon={<ImageIcon className="h-3.5 w-3.5" />}>
        <BackgroundPanel />
      </Section>

      <Section title={t("settings.shortcuts")} icon={<Keyboard className="h-3.5 w-3.5" />}>
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {shortcuts.map(([label, key]) => (
            <div key={label} className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-foreground">{label}</span>
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{key}</kbd>
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
          <p className="font-mono text-xs font-medium text-foreground">common-agent v0.0.1</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("settings.aboutDesc")}</p>
        </a>
      </Section>
    </>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}
