import { Route, Routes, Navigate } from "react-router"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastProvider } from "@/components/ui/toast"
import { AuthProvider, useAuth } from "@/lib/auth"
import { LoginPage } from "@/components/auth/login-page"
import { AuthenticatedShell } from "./routes/authenticated-shell"
import { WorkspaceRoute } from "./routes/workspace-route"
import { ManageRoute } from "./routes/manage-route"
import { KanbanRoute } from "./routes/kanban-route"
import { RequestLogsRoute } from "./routes/request-logs-route"
import { UsageRoute } from "./routes/usage-route"
import { AgentEditorRoute } from "./routes/agent-editor-route"
import { AgentDetailRoute } from "./routes/agent-detail-route"
import { SkillFormRoute } from "./routes/skill-form-route"
import { KanbanCreateRoute } from "./routes/kanban-create-route"
import { KanbanDetailRoute } from "./routes/kanban-detail-route"
import { AdminRoute } from "./routes/admin-route"
import { SettingsRoute } from "./routes/settings-route"
import { ApiDocsRoute } from "./routes/api-docs-route"
import { SessionDetailRoute } from "./routes/session-detail-route"

/** `key` remounts LoginPage when hasUsers resolves so mode is correct without a reset effect. */
function LoginGate() {
  const { hasUsers } = useAuth()
  return <LoginPage key={String(hasUsers)} hasUsers={hasUsers} />
}

export function App() {
  return (
    <ThemeProvider defaultMode="dark">
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginGate />} />
            <Route element={<AuthenticatedShell />}>
              <Route path="/settings" element={<SettingsRoute />} />
              <Route path="/admin" element={<AdminRoute />} />
              <Route path="/api-docs" element={<ApiDocsRoute />} />
              <Route path="/manage" element={<ManageRoute />} />
              <Route path="/kanban" element={<KanbanRoute />} />
              <Route path="/kanban/new" element={<KanbanCreateRoute />} />
              <Route path="/kanban/:taskId" element={<KanbanDetailRoute />} />
              <Route path="/request-logs" element={<RequestLogsRoute />} />
              <Route path="/usage" element={<UsageRoute />} />
              <Route
                path="/manage/agents/new"
                element={<AgentEditorRoute mode="create" />}
              />
              <Route
                path="/manage/agents/:agentId/edit"
                element={<AgentEditorRoute mode="edit" />}
              />
              <Route
                path="/manage/agents/:agentId"
                element={<AgentDetailRoute />}
              />
              <Route
                path="/manage/skills/new"
                element={<SkillFormRoute mode="create" />}
              />
              <Route
                path="/manage/skills/:name/edit"
                element={<SkillFormRoute mode="edit" />}
              />
              <Route path="/agents/:agentName" element={<WorkspaceRoute />} />
              <Route
                path="/sessions/:sessionId"
                element={<SessionDetailRoute />}
              />
              <Route path="/" element={<WorkspaceRoute />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
