import { Outlet, Route, Routes, Navigate } from "react-router"
import { ThemeProvider } from "@/components/theme-provider"
import { BackgroundProvider } from "@/components/background/background-provider"
import { LoginPage } from "@/components/auth/login-page"
import { RequireAuth } from "@/components/auth/require-auth"
import { AuthProvider } from "@/lib/auth"
import { WorkspaceRoute } from "./routes/workspace-route"
import { ManageRoute } from "./routes/manage-route"
import { KanbanRoute } from "./routes/kanban-route"
import { RequestLogsRoute } from "./routes/request-logs-route"
import { AgentEditorRoute } from "./routes/agent-editor-route"
import { AdminRoute } from "./routes/admin-route"
import { SettingsRoute } from "./routes/settings-route"
import { ApiDocsRoute } from "./routes/api-docs-route"

function AuthenticatedShell() {
  return (
    <RequireAuth>
      <BackgroundProvider>
        <Outlet />
      </BackgroundProvider>
    </RequireAuth>
  )
}

export function App() {
  return (
    <ThemeProvider defaultMode="dark">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthenticatedShell />}>
            <Route path="/settings" element={<SettingsRoute />} />
            <Route path="/admin" element={<AdminRoute />} />
            <Route path="/api-docs" element={<ApiDocsRoute />} />
            <Route path="/manage" element={<ManageRoute />} />
            <Route path="/kanban" element={<KanbanRoute />} />
            <Route path="/request-logs" element={<RequestLogsRoute />} />
            <Route
              path="/manage/agents/new"
              element={<AgentEditorRoute mode="create" />}
            />
            <Route
              path="/manage/agents/:agentId/edit"
              element={<AgentEditorRoute mode="edit" />}
            />
            <Route path="/agents/:agentName" element={<WorkspaceRoute />} />
            <Route path="/" element={<WorkspaceRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
