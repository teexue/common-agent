import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { TopBar } from "./top-bar"
import { Sidebar } from "./sidebar"
import type {
  AgentInfo,
  SessionMeta,
  SkillInfo,
  StreamStatus,
  ToolInfo,
} from "@/types/agent"

interface AppLayoutProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  agents: AgentInfo[]
  selectedAgent: string
  onSelectAgent: (name: string) => void
  tools: ToolInfo[]
  onSelectTool: (tool: ToolInfo) => void
  onOpenSettings: () => void
  onNewSession?: () => void
  sessions?: SessionMeta[]
  activeSessionId?: string | null
  onResumeSession?: (id: string) => void
  onDeleteSession?: (id: string) => void
  onReplaySession?: (id: string) => void
  onViewAgent?: (name: string) => void
  onEditAgent?: (name: string) => void
  onDeleteAgent?: (name: string) => void
  onCreateAgent?: () => void
  skills?: SkillInfo[]
  agent: AgentInfo
  status: StreamStatus
  inspectorOpen: boolean
  onToggleInspector: () => void
  theme: string
  onToggleTheme: () => void
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
}

export function AppLayout({ inspectorOpen, leftPanel, rightPanel, agent, status, onToggleInspector, theme, onToggleTheme, ...sidebarProps }: AppLayoutProps) {
  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <Sidebar {...sidebarProps} collapsed={sidebarProps.sidebarCollapsed} onToggle={sidebarProps.onToggleSidebar} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar agent={agent} status={status} artifactOpen={inspectorOpen} onToggleArtifact={onToggleInspector} theme={theme} onToggleTheme={onToggleTheme} />

        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize={inspectorOpen ? 60 : 100} minSize={35} className="bg-background">
            {leftPanel}
          </ResizablePanel>
          {inspectorOpen && (
            <>
              <ResizableHandle className="w-[3px] bg-border/40 transition-colors hover:bg-primary/25" />
              <ResizablePanel defaultSize={40} minSize={25} className="border-l border-border bg-card/30">
                {rightPanel}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
