import { useNavigate, useSearchParams } from "react-router"
import { useTranslation } from "react-i18next"
import { KeyRound, Monitor, ScrollText, ShieldCheck, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { RequestLogsPanel } from "@/components/audit/request-logs-panel"
import { ApiKeysPanel } from "@/components/settings/api-keys-panel"
import { MetricsPanel } from "@/components/monitoring/metrics-panel"
import { UsersPanel } from "@/components/settings/users-panel"

const TAB_VALUES = ["users", "api-keys", "monitoring", "request-logs"] as const

/** Admin hub: user accounts, API keys, runtime monitoring, and request audit logs. */
export function AdminPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get("tab") || "users"
  const activeTab = (TAB_VALUES as readonly string[]).includes(rawTab)
    ? rawTab
    : "users"

  const tabTriggers = [
    { value: "users", icon: Users, label: t("admin.tabUsers") },
    { value: "api-keys", icon: KeyRound, label: t("admin.tabApiKeys") },
    { value: "monitoring", icon: Monitor, label: t("admin.tabMonitoring") },
    { value: "request-logs", icon: ScrollText, label: t("admin.tabRequestLogs") },
  ]

  const handleTabChange = (value: string) => {
    setSearchParams(value === "users" ? {} : { tab: value })
  }

  return (
    <PageShell>
      <PageHeader
        icon={ShieldCheck}
        title={t("admin.title")}
        onBack={() => navigate(-1)}
      />

      <PageMain contentClassName="w-full">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6 w-full rounded-xl bg-muted p-0.5">
            {tabTriggers.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 gap-1.5 rounded-lg text-xs"
              >
                <tab.icon className="h-3 w-3" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="users" className="mt-0 space-y-4">
            <Section title={t("settings.users")} icon={<Users className="h-3.5 w-3.5" />}>
              <UsersPanel />
            </Section>
          </TabsContent>

          <TabsContent value="api-keys" className="mt-0 space-y-4">
            <Section title={t("settings.apiKeys")} icon={<KeyRound className="h-3.5 w-3.5" />}>
              <ApiKeysPanel />
            </Section>
          </TabsContent>

          <TabsContent value="monitoring" className="mt-0 space-y-4">
            <Section
              title={t("settings.runtimeMetrics")}
              icon={<Monitor className="h-3.5 w-3.5" />}
            >
              <MetricsPanel />
            </Section>
          </TabsContent>

          <TabsContent value="request-logs" className="mt-0 space-y-4">
            <Section
              title={t("audit.title")}
              icon={<ScrollText className="h-3.5 w-3.5" />}
            >
              <RequestLogsPanel />
            </Section>
          </TabsContent>
        </Tabs>
      </PageMain>
    </PageShell>
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
