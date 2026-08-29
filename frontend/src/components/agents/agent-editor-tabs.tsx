import { Bot, Plug, Settings2, Shield, Wrench } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AgentFormData } from "@/lib/agent-yaml"
import type { ProviderInfo, ToolInfo } from "@/types/agent"
import { BasicTab } from "./tabs/basic-tab"
import { McpTab } from "./tabs/mcp-tab"
import { RuntimeTab } from "./tabs/runtime-tab"
import { ToolsTab } from "./tabs/tools-tab"

interface EditorTabsProps {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
  providers: ProviderInfo[]
  tools: ToolInfo[]
  knowledgeBases: Array<{ id: string; name: string }>
  tab: string
  setTab: (tab: string) => void
  error: string | null
  isCreate: boolean
}

export function AgentEditorTabs(props: EditorTabsProps) {
  const { t } = useTranslation()
  const tabs = [
    { value: "basic", icon: Bot, label: t("agent.tabBasic") },
    { value: "tools", icon: Wrench, label: t("agent.tabTools") },
    { value: "mcp", icon: Plug, label: t("agent.tabMcp") },
    { value: "runtime", icon: Settings2, label: t("agent.tabRuntime") },
  ] as const

  return (
    <Tabs value={props.tab} onValueChange={props.setTab}>
      <TabsList className="mb-6 w-full rounded-xl bg-muted p-0.5">
        {tabs.map((item) => (
          <EditorTabTrigger key={item.value} item={item} form={props.form} />
        ))}
      </TabsList>
      {props.error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{props.error}</span>
        </div>
      )}
      <EditorTabPanels {...props} />
    </Tabs>
  )
}

function EditorTabTrigger({
  item,
  form,
}: {
  item: {
    value: string
    icon: React.ComponentType<{ className?: string }>
    label: string
  }
  form: AgentFormData
}) {
  const count =
    item.value === "tools"
      ? form.tools.length
      : item.value === "mcp"
        ? form.mcpServers.length
        : 0
  return (
    <TabsTrigger
      value={item.value}
      className="flex-1 gap-1.5 rounded-lg text-xs"
    >
      <item.icon className="h-3 w-3" /> {item.label}
      {count > 0 && (
        <Badge
          variant="secondary"
          className="rounded-md px-1.5 py-0 text-[10px]"
        >
          {count}
        </Badge>
      )}
    </TabsTrigger>
  )
}

function EditorTabPanels({
  form,
  setForm,
  providers,
  tools,
  knowledgeBases,
  isCreate,
}: EditorTabsProps) {
  return (
    <>
      <TabsContent value="basic" className="mt-0">
        <BasicTab
          form={form}
          setForm={setForm}
          providers={providers}
          isCreate={isCreate}
        />
      </TabsContent>
      <TabsContent value="tools" className="mt-0">
        <ToolsTab form={form} setForm={setForm} tools={tools} />
      </TabsContent>
      <TabsContent value="mcp" className="mt-0">
        <McpTab form={form} setForm={setForm} />
      </TabsContent>
      <TabsContent value="runtime" className="mt-0">
        <RuntimeTab
          form={form}
          setForm={setForm}
          knowledgeBases={knowledgeBases}
        />
      </TabsContent>
    </>
  )
}
