import { useNavigate, useParams } from "react-router"
import { KanbanDetailPage } from "@/components/kanban/kanban-detail-page"

export function KanbanDetailRoute() {
  const navigate = useNavigate()
  const { taskId } = useParams<{ taskId: string }>()
  return (
    <KanbanDetailPage
      taskId={decodeURIComponent(taskId || "")}
      onBack={() => navigate("/kanban")}
      onViewLogs={(sessionId) =>
        navigate(`/request-logs?session=${encodeURIComponent(sessionId)}`)
      }
    />
  )
}
