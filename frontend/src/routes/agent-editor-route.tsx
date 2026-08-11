import { useNavigate, useParams } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"
import { AppLayout } from "@/components/layout/app-layout"
import { AgentEditorPage } from "@/components/agents/agent-editor"
import { SessionReplay } from "@/components/sessions/session-replay"
import { useShellNav, shellLayoutProps } from "./shell-hooks"

export function AgentEditorRoute({ mode }: { mode: "create" | "edit" }) {
  const { theme, setTheme } = useTheme()
  const shell = useShellNav()
  const navigate = useNavigate()
  const { agentId } = useParams<{ agentId: string }>()
  const id = mode === "edit" ? decodeURIComponent(agentId || "") : null

  return (
    <TooltipProvider delay={300}>
      <AppLayout
        {...shellLayoutProps(shell, theme, setTheme)}
        leftPanel={
          <AgentEditorPage
            agentId={id}
            onBack={() => navigate("/manage")}
            onSaved={() => navigate("/manage")}
          />
        }
      />
      <SessionReplay
        sessionId={shell.replaySessionId}
        open={!!shell.replaySessionId}
        onOpenChange={(open) => {
          if (!open) shell.setReplaySessionId(null)
        }}
      />
    </TooltipProvider>
  )
}
