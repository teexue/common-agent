import { TooltipProvider } from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"
import { AppLayout } from "@/components/layout/app-layout"
import { SettingsPage } from "@/components/settings/settings-page"
import { SessionReplay } from "@/components/sessions/session-replay"
import { useShellNav, shellLayoutProps } from "./shell-hooks"

export function SettingsRoute() {
  const { theme, setTheme } = useTheme()
  const shell = useShellNav()

  return (
    <TooltipProvider delay={300}>
      <AppLayout
        {...shellLayoutProps(shell, theme, setTheme)}
        onOpenSettings={() => {}}
        leftPanel={<SettingsPage />}
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
