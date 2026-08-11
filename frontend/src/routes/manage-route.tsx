import { useCallback, useState } from "react"
import { useNavigate } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"
import { AppLayout } from "@/components/layout/app-layout"
import { ManagePage } from "@/components/manage/manage-page"
import { useAgentManager } from "@/hooks/use-agent-manager"
import type { ToolInfo } from "@/types/agent"
import { AppDialogs } from "./app-dialogs"
import { useShellNav, shellLayoutProps } from "./shell-hooks"

export function ManageRoute() {
  const { theme, setTheme } = useTheme()
  const shell = useShellNav()
  const navigate = useNavigate()
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null)
  const [agentsRefreshKey, setAgentsRefreshKey] = useState(0)

  const agentMgr = useAgentManager({
    onAgentsChanged: useCallback(() => setAgentsRefreshKey((k) => k + 1), []),
  })

  return (
    <TooltipProvider delay={300}>
      <AppLayout
        {...shellLayoutProps(shell, theme, setTheme)}
        leftPanel={
          <ManagePage
            onViewAgent={agentMgr.handleViewAgent}
            onEditAgent={(id) =>
              navigate(`/manage/agents/${encodeURIComponent(id)}/edit`)
            }
            onDeleteAgent={agentMgr.handleDeleteAgent}
            onCreateAgent={() => navigate("/manage/agents/new")}
            onSelectTool={setSelectedTool}
            agentsRefreshKey={agentsRefreshKey}
          />
        }
      />
      <AppDialogs
        agentMgr={agentMgr}
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        replaySessionId={shell.replaySessionId}
        setReplaySessionId={shell.setReplaySessionId}
        onEditAgent={(id) =>
          navigate(`/manage/agents/${encodeURIComponent(id)}/edit`)
        }
      />
    </TooltipProvider>
  )
}
