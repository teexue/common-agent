import { Navigate } from "react-router"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"
import { AppLayout } from "@/components/layout/app-layout"
import { AdminPage } from "@/components/admin/admin-page"
import { SessionReplay } from "@/components/sessions/session-replay"
import { useAuth } from "@/lib/auth"
import { useShellNav, shellLayoutProps } from "./shell-hooks"

export function AdminRoute() {
  const { theme, setTheme } = useTheme()
  const shell = useShellNav()
  const { user, state } = useAuth()

  if (state === "loading") return null
  if (user?.role !== "admin") return <Navigate to="/" replace />

  return (
    <TooltipProvider delay={300}>
      <AppLayout
        {...shellLayoutProps(shell, theme, setTheme)}
        leftPanel={<AdminPage />}
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
