import { useNavigate } from "react-router"
import { KanbanCreatePage } from "@/components/kanban/kanban-create-page"

export function KanbanCreateRoute() {
  const navigate = useNavigate()
  return (
    <KanbanCreatePage
      onBack={() => navigate("/kanban")}
      onCreated={() => navigate("/kanban")}
    />
  )
}
