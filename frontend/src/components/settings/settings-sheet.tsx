import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bot, FolderOpen, Keyboard, Monitor, Plug, Server, Settings } from "lucide-react"
import { Input } from "@/components/ui/input"
import { MetricsPanel } from "@/components/monitoring/metrics-panel"
import type { AgentInfo } from "@/types/agent"

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme: string
  onThemeChange: (theme: string) => void
  agents?: AgentInfo[]
  workDir?: string
  onWorkDirChange?: (dir: string) => void
}

const THEME_OPTIONS = [
  { value: "light", label: "亮色" },
  { value: "dark", label: "暗色" },
  { value: "system", label: "跟随系统" },
]

const SHORTCUTS = [
  ["切换侧边栏", "⌘ Shift S"],
  ["关闭面板", "Esc"],
  ["发送消息", "Enter"],
  ["换行", "Shift Enter"],
] as const

const TAB_TRIGGERS = [
  { value: "general", icon: Settings, label: "通用" },
  { value: "monitoring", icon: Monitor, label: "监控" },
  { value: "providers", icon: Server, label: "提供商" },
  { value: "mcp", icon: Plug, label: "MCP" },
] as const

export function SettingsSheet({ open, onOpenChange, theme, onThemeChange, agents = [], workDir = "", onWorkDirChange }: SettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-[400px] border-border bg-card overflow-y-auto">
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center gap-2 font-heading text-base tracking-tight">
            <Settings className="h-4 w-4 text-primary" /> 设置
          </SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-6">
          <Tabs defaultValue="general">
            <TabsList className="w-full rounded-xl bg-muted p-0.5 mb-5">
              {TAB_TRIGGERS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="flex-1 rounded-lg text-xs">
                  <t.icon className="mr-1 h-3 w-3" /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="general" className="mt-0 space-y-6">
              <GeneralTab theme={theme} onThemeChange={onThemeChange} workDir={workDir} onWorkDirChange={onWorkDirChange} />
            </TabsContent>
            <TabsContent value="monitoring" className="mt-0 space-y-4">
              <Section title="运行时指标" icon={<Monitor className="h-3.5 w-3.5" />}><MetricsPanel /></Section>
            </TabsContent>
            <TabsContent value="providers" className="mt-0 space-y-4">
              <Section title="已配置的 Agent" icon={<Server className="h-3.5 w-3.5" />}>
                {agents.length === 0 ? <EmptyState text="暂无 Agent 配置" /> : <div className="space-y-2">{agents.map((a) => <AgentCard key={a.name} agent={a} />)}</div>}
              </Section>
              <div className="rounded-xl border border-dashed border-border px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                提供商管理请通过 CLI：<code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">agent-server config set provider</code>
              </div>
            </TabsContent>
            <TabsContent value="mcp" className="mt-0 space-y-4">
              <Section title="MCP 服务器" icon={<Plug className="h-3.5 w-3.5" />}><MCPPanel /></Section>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Tab content ──────────────────────────────────────────────────

function GeneralTab({ theme, onThemeChange, workDir, onWorkDirChange }: Pick<SettingsSheetProps, "theme" | "onThemeChange" | "workDir" | "onWorkDirChange">) {
  return (
    <>
      <Section title="外观">
        <Select
          value={{ value: theme, label: THEME_OPTIONS.find(t => t.value === theme)?.label ?? theme }}
          onValueChange={(v) => { if (v && typeof v === "object" && "value" in v) onThemeChange((v as { value: string }).value) }}
        >
          <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            {THEME_OPTIONS.map((t) => <SelectItem key={t.value} value={{ value: t.value, label: t.label }}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Section>

      <Section title="工作目录" icon={<FolderOpen className="h-3.5 w-3.5" />}>
        <Input value={workDir} onChange={(e) => onWorkDirChange?.(e.target.value)} placeholder="留空使用服务端默认目录" className="rounded-xl font-mono text-xs" />
        <p className="text-[10px] text-muted-foreground leading-relaxed mt-1.5">文件读写工具的根目录，留空则使用启动服务时的目录。</p>
      </Section>

      <Section title="快捷键" icon={<Keyboard className="h-3.5 w-3.5" />}>
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {SHORTCUTS.map(([label, key]) => (
            <div key={label} className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-foreground">{label}</span>
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{key}</kbd>
            </div>
          ))}
        </div>
      </Section>

      <Section title="关于">
        <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
          <p className="font-mono text-xs font-medium text-foreground">common-agent v0.0.1</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">通用 Agent 运行时</p>
        </div>
      </Section>
    </>
  )
}

// ─── Internal components ──────────────────────────────────────────

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

function AgentCard({ agent }: { agent: AgentInfo }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">
          {agent.name}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          {agent.provider && (
            <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[9px] font-mono">
              {agent.provider}
            </Badge>
          )}
          {agent.model && (
            <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[9px] font-mono">
              {agent.model}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-6">
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

// ─── MCP Panel ────────────────────────────────────────────────────

import { useEffect, useState as useStateMCP } from "react"
import { fetchMCPServers as fetchMCP } from "@/lib/api"
import type { MCPServerInfo } from "@/types/agent"

function MCPServerCard({ server }: { server: MCPServerInfo }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
        <Plug className="h-4 w-4 text-blue-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">{server.name}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[9px] font-mono">{server.type}</Badge>
          {server.command && <span className="text-[9px] text-muted-foreground font-mono truncate">{server.command}</span>}
          {server.url && <span className="text-[9px] text-muted-foreground font-mono truncate">{server.url}</span>}
        </div>
      </div>
      <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[9px] shrink-0">{server.agent}</Badge>
    </div>
  )
}

function MCPPanel() {
  const [servers, setServers] = useStateMCP<MCPServerInfo[]>([])
  const [loading, setLoading] = useStateMCP(true)

  useEffect(() => {
    fetchMCP().then(setServers).catch(() => setServers([])).finally(() => setLoading(false))
  }, [])

  if (loading) return <EmptyState text="加载中..." />
  if (servers.length === 0) {
    return (
      <div className="space-y-3">
        <EmptyState text="未配置 MCP 服务器" />
        <div className="rounded-xl border border-dashed border-border px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
          在 Agent YAML 中配置 <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">mcp_servers</code> 字段来添加 MCP 服务器。
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {servers.map((s) => <MCPServerCard key={`${s.agent}-${s.name}`} server={s} />)}
    </div>
  )
}
