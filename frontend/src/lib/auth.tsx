import { createContext, useContext, type ReactNode } from "react"
import type { AuthUserInfo } from "@/lib/api"
import { useAuthSession, type AuthState } from "./auth-session"

export type { AuthState }

interface AuthContextValue {
  state: AuthState
  user: AuthUserInfo | null
  hasUsers: boolean
  allowRegistration: boolean
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Provides session auth state for the SPA login gate. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthSession()
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Returns the auth context; must be used under AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
