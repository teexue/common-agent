import { WorkspaceShell } from "./workspace-shell"
import { useWorkspacePage } from "./use-workspace-page"

export function WorkspaceRoute() {
  const page = useWorkspacePage()
  return <WorkspaceShell page={page} />
}
