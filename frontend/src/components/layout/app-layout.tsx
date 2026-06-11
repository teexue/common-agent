import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { TopBar } from "./top-bar"
import { Sidebar } from "./sidebar"
import type { ScenarioInfo, StreamStatus, ToolInfo } from "@/types/agent"

interface AppLayoutProps {
  // Sidebar
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  scenarios: ScenarioInfo[]
  selectedScenario: string
  onSelectScenario: (name: string) => void
  tools: ToolInfo[]
  onSelectTool: (tool: ToolInfo) => void
  onOpenSettings: () => void
  onNewSession?: () => void

  // Top bar
  scenario: ScenarioInfo
  status: StreamStatus
  inspectorOpen: boolean
  onToggleInspector: () => void
  theme: string
  onToggleTheme: () => void

  // Panels
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
}

export function AppLayout({
  sidebarCollapsed,
  onToggleSidebar,
  scenarios,
  selectedScenario,
  onSelectScenario,
  tools,
  onSelectTool,
  onOpenSettings,
  onNewSession,
  scenario,
  status,
  inspectorOpen,
  onToggleInspector,
  theme,
  onToggleTheme,
  leftPanel,
  rightPanel,
}: AppLayoutProps) {
  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={onToggleSidebar}
        scenarios={scenarios}
        selectedScenario={selectedScenario}
        onSelectScenario={onSelectScenario}
        tools={tools}
        onSelectTool={onSelectTool}
        onOpenSettings={onOpenSettings}
        onNewSession={onNewSession}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          scenario={scenario}
          status={status}
          artifactOpen={inspectorOpen}
          onToggleArtifact={onToggleInspector}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />

        <ResizablePanelGroup
          orientation="horizontal"
          className="flex-1"
        >
          <ResizablePanel
            defaultSize={inspectorOpen ? 60 : 100}
            minSize={35}
            className="bg-background"
          >
            {leftPanel}
          </ResizablePanel>

          {inspectorOpen && (
            <>
              <ResizableHandle className="w-[3px] bg-border/40 transition-colors hover:bg-primary/25" />
              <ResizablePanel
                defaultSize={40}
                minSize={25}
                className="border-l border-border bg-card/30"
              >
                {rightPanel}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
