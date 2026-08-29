import { Navigate } from "react-router"
import { AdminPage } from "@/components/admin/admin-page"
import { useAuth } from "@/lib/auth"

export function AdminRoute() {
  const { user, state } = useAuth()
  if (state === "loading") return null
  if (user?.role !== "admin") return <Navigate to="/" replace />
  return <AdminPage />
}
