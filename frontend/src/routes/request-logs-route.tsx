import { TooltipProvider } from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"
import { AppLayout } from "@/components/layout/app-layout"
import { RequestLogsPage } from "@/components/audit/request-logs-page"
import { SessionReplay } from "@/components/sessions/session-replay"
import { useShellNav, shellLayoutProps } from "./shell-hooks"

export function RequestLogsRoute() {
  const { theme, setTheme } = useTheme()
  const shell = useShellNav()

  return (
    <TooltipProvider delay={300}>
      <AppLayout
        {...shellLayoutProps(shell, theme, setTheme)}
        leftPanel={<RequestLogsPage />}
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
