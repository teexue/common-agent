import { useSearchParams } from "react-router"
import { useTranslation } from "react-i18next"
import {
  KeyRound,
  Monitor,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { ApiKeysPanel } from "@/components/settings/api-keys-panel"
import { MetricsPanel } from "@/components/monitoring/metrics-panel"
import { UsersPanel } from "@/components/settings/users-panel"

interface AdminTab {
  value: string
  icon: LucideIcon
  tabKey: string
  Panel: React.ComponentType
}

const ADMIN_TABS: AdminTab[] = [
  {
    value: "users",
    icon: Users,
    tabKey: "admin.tabUsers",
    Panel: UsersPanel,
  },
  {
    value: "api-keys",
    icon: KeyRound,
    tabKey: "admin.tabApiKeys",
    Panel: ApiKeysPanel,
  },
  {
    value: "monitoring",
    icon: Monitor,
    tabKey: "admin.tabMonitoring",
    Panel: MetricsPanel,
  },
]

const TAB_VALUES = ADMIN_TABS.map((tab) => tab.value)

/** Admin hub: user accounts, API keys, and runtime monitoring. */
export function AdminPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get("tab") || "users"
  const activeTab = TAB_VALUES.includes(rawTab) ? rawTab : "users"

  return (
    <PageShell>
      <PageHeader icon={ShieldCheck} title={t("admin.title")} />
      <PageMain
        className="overflow-hidden"
        contentClassName="flex h-full min-h-0 w-full p-0"
      >
        <Tabs
          orientation="vertical"
          value={activeTab}
          onValueChange={(value) => {
            setSearchParams(value === "users" ? {} : { tab: value })
          }}
          className="h-full min-h-0 w-full gap-0"
        >
          <AdminTabList />
          <div className="min-h-0 min-w-0 flex-1 overflow-auto px-6 py-6">
            {ADMIN_TABS.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                <tab.Panel />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </PageMain>
    </PageShell>
  )
}

function AdminTabList() {
  const { t } = useTranslation()
  return (
    <TabsList
      variant="line"
      className="h-full w-48 shrink-0 flex-col items-stretch justify-start gap-0.5 rounded-none border-r border-border bg-transparent p-3"
    >
      {ADMIN_TABS.map((tab) => (
        <TabsTrigger
          key={tab.value}
          value={tab.value}
          className="h-9 w-full flex-none justify-start gap-2 rounded-lg px-2.5 text-xs after:hidden data-active:bg-primary/10 data-active:text-primary data-active:shadow-none"
        >
          <tab.icon className="h-3.5 w-3.5" /> {t(tab.tabKey)}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
