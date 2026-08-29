import { useSearchParams } from "react-router"
import { useTranslation } from "react-i18next"
import {
  Coins,
  KeyRound,
  Monitor,
  ScrollText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { RequestLogsPanel } from "@/components/audit/request-logs-panel"
import { UsagePanel } from "@/components/usage/usage-panel"
import { ApiKeysPanel } from "@/components/settings/api-keys-panel"
import { MetricsPanel } from "@/components/monitoring/metrics-panel"
import { UsersPanel } from "@/components/settings/users-panel"

interface AdminTab {
  value: string
  icon: LucideIcon
  tabKey: string
  titleKey: string
  Panel: React.ComponentType
}

const ADMIN_TABS: AdminTab[] = [
  {
    value: "users",
    icon: Users,
    tabKey: "admin.tabUsers",
    titleKey: "settings.users",
    Panel: UsersPanel,
  },
  {
    value: "api-keys",
    icon: KeyRound,
    tabKey: "admin.tabApiKeys",
    titleKey: "settings.apiKeys",
    Panel: ApiKeysPanel,
  },
  {
    value: "usage",
    icon: Coins,
    tabKey: "admin.tabUsage",
    titleKey: "usage.title",
    Panel: UsagePanel,
  },
  {
    value: "monitoring",
    icon: Monitor,
    tabKey: "admin.tabMonitoring",
    titleKey: "settings.runtimeMetrics",
    Panel: MetricsPanel,
  },
  {
    value: "request-logs",
    icon: ScrollText,
    tabKey: "admin.tabRequestLogs",
    titleKey: "audit.title",
    Panel: RequestLogsPanel,
  },
]

const TAB_VALUES = ADMIN_TABS.map((tab) => tab.value)

/** Admin hub: user accounts, API keys, runtime monitoring, and request audit logs. */
export function AdminPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get("tab") || "users"
  const activeTab = TAB_VALUES.includes(rawTab) ? rawTab : "users"

  const handleTabChange = (value: string) => {
    setSearchParams(value === "users" ? {} : { tab: value })
  }

  return (
    <PageShell>
      <PageHeader icon={ShieldCheck} title={t("admin.title")} />
      <PageMain contentClassName="w-full">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <AdminTabList />
          {ADMIN_TABS.map((tab) => (
            <TabsContent
              key={tab.value}
              value={tab.value}
              className="mt-0 space-y-4"
            >
              <Section
                title={t(tab.titleKey)}
                icon={<tab.icon className="h-3.5 w-3.5" />}
              >
                <tab.Panel />
              </Section>
            </TabsContent>
          ))}
        </Tabs>
      </PageMain>
    </PageShell>
  )
}

function AdminTabList() {
  const { t } = useTranslation()
  return (
    <TabsList className="mb-6 w-full rounded-xl bg-muted p-0.5">
      {ADMIN_TABS.map((tab) => (
        <TabsTrigger
          key={tab.value}
          value={tab.value}
          className="flex-1 gap-1.5 rounded-lg text-xs"
        >
          <tab.icon className="h-3 w-3" /> {t(tab.tabKey)}
        </TabsTrigger>
      ))}
    </TabsList>
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
