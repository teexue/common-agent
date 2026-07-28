import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { BackgroundLayer } from "@/components/background/background-layer"
import { TopBar } from "./top-bar"
import { Sidebar } from "./sidebar"
import type {
  AgentInfo,
  SessionMeta,
  StreamStatus,
} from "@/types/agent"

interface AppLayoutProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenSettings: () => void
  onOpenManage?: () => void
  onOpenApiDocs?: () => void
  onNewSession?: () => void
  sessions?: SessionMeta[]
  activeSessionId?: string | null
  onResumeSession?: (id: string) => void
  onDeleteSession?: (id: string) => void
  onReplaySession?: (id: string) => void
  agent: AgentInfo
  agents?: AgentInfo[]
  agentLocked?: boolean
  onSelectAgent?: (id: string) => void
  status: StreamStatus
  inspectorOpen: boolean
  onToggleInspector: () => void
  theme: string
  onToggleTheme: () => void
  showInspector?: boolean
  leftPanel: React.ReactNode
  rightPanel?: React.ReactNode
  /** actions rendered in the TopBar right-side button group */
  topBarActions?: React.ReactNode
}

export function AppLayout({
  inspectorOpen, showInspector = true, leftPanel, rightPanel, topBarActions,
  agent, agents, agentLocked, onSelectAgent,
  status, onToggleInspector, theme, onToggleTheme,
  ...sidebarProps
}: AppLayoutProps) {
  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <BackgroundLayer />
      <Sidebar
        {...sidebarProps}
        agents={agents}
        collapsed={sidebarProps.sidebarCollapsed}
        onToggle={sidebarProps.onToggleSidebar}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {showInspector && (
          <TopBar
            agent={agent}
            agents={agents}
            agentLocked={agentLocked}
            onSelectAgent={onSelectAgent}
            status={status}
            artifactOpen={inspectorOpen}
            onToggleArtifact={onToggleInspector}
            theme={theme}
            onToggleTheme={onToggleTheme}
            actions={topBarActions}
          />
        )}

        {showInspector ? (
          <ResizablePanelGroup orientation="horizontal" className="flex-1">
            <ResizablePanel defaultSize={inspectorOpen ? 74 : 100} minSize={35} className="bg-background">
              {leftPanel}
            </ResizablePanel>
            {inspectorOpen && rightPanel && (
              <>
                <ResizableHandle className="w-1 bg-border transition-colors hover:bg-primary/25" />
                <ResizablePanel defaultSize={26} minSize={20} className="border-l border-border bg-background">
                  {rightPanel}
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        ) : (
          <div className="flex-1 overflow-hidden">
            {leftPanel}
          </div>
        )}
      </div>
    </div>
  )
}
