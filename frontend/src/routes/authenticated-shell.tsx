import { Outlet } from "react-router"
import { TooltipProvider } from "@/components/ui/tooltip"
import { RequireAuth } from "@/components/auth/require-auth"
import { BackgroundProvider } from "@/components/background/background-provider"
import { useTheme } from "@/components/theme-provider"
import { AppLayout } from "@/components/layout/app-layout"
import { useShellNav, shellLayoutProps } from "./shell-hooks"
import { ShellNavProvider } from "./shell-context"
import { ChatProvider } from "./chat-context"
import { useWorkspaceChrome } from "./workspace-chrome"

function ShellLayout() {
  const shell = useShellNav()
  const { theme, setTheme } = useTheme()
  const extra = useWorkspaceChrome()
  return (
    <ShellNavProvider value={shell}>
      <TooltipProvider delay={300}>
        <AppLayout
          {...shellLayoutProps(shell, theme, setTheme)}
          {...extra}
          leftPanel={<Outlet />}
        />
      </TooltipProvider>
    </ShellNavProvider>
  )
}

export function AuthenticatedShell() {
  return (
    <RequireAuth>
      <BackgroundProvider>
        <ChatProvider>
          <ShellLayout />
        </ChatProvider>
      </BackgroundProvider>
    </RequireAuth>
  )
}
