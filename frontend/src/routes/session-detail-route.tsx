import { useParams } from "react-router"
import { SessionDetailPage } from "@/components/session/session-detail-page"

export function SessionDetailRoute() {
  const { sessionId } = useParams<{ sessionId: string }>()
  return <SessionDetailPage sessionId={decodeURIComponent(sessionId || "")} />
}
