import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  fetchAuthMe,
  fetchAuthStatus,
  getAccessToken,
  setAccessToken,
  SERVER_API_KEY_CHANGED,
  type AuthUserInfo,
} from "@/lib/api"

export type AuthState = "loading" | "authenticated" | "unauthenticated"

interface AuthContextValue {
  state: AuthState
  user: AuthUserInfo | null
  hasUsers: boolean
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Provides session auth state for the SPA login gate. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("loading")
  const [user, setUser] = useState<AuthUserInfo | null>(null)
  const [hasUsers, setHasUsers] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const status = await fetchAuthStatus()
      setHasUsers(!!status.has_users)
    } catch {
      setHasUsers(false)
    }

    const token = getAccessToken()
    if (!token) {
      setUser(null)
      setState("unauthenticated")
      return
    }

    try {
      const me = await fetchAuthMe()
      if (!me.user) {
        setAccessToken("")
        setUser(null)
        setState("unauthenticated")
        return
      }
      setUser(me.user)
      setState("authenticated")
    } catch {
      setAccessToken("")
      setUser(null)
      setState("unauthenticated")
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onTokenChange = () => {
      void refresh()
    }
    const onUnauthorized = () => {
      setAccessToken("")
      setUser(null)
      setState("unauthenticated")
    }
    window.addEventListener(SERVER_API_KEY_CHANGED, onTokenChange)
    window.addEventListener("auth:unauthorized", onUnauthorized)
    return () => {
      window.removeEventListener(SERVER_API_KEY_CHANGED, onTokenChange)
      window.removeEventListener("auth:unauthorized", onUnauthorized)
    }
  }, [refresh])

  const logout = useCallback(() => {
    setAccessToken("")
    setUser(null)
    setState("unauthenticated")
  }, [])

  return (
    <AuthContext.Provider value={{ state, user, hasUsers, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Returns the auth context; must be used under AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
