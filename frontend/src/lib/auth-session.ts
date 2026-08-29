import { useCallback, useEffect, useRef, useState } from "react"
import {
  fetchAuthMe,
  fetchAuthStatus,
  getAccessToken,
  setAccessToken,
  SERVER_API_KEY_CHANGED,
  type AuthUserInfo,
} from "@/lib/api"
import { useToast } from "@/components/ui/toast"
import i18n from "@/i18n"

export type AuthState = "loading" | "authenticated" | "unauthenticated"

function useAuthRefresh(
  setState: (s: AuthState) => void,
  setUser: (u: AuthUserInfo | null) => void,
  setHasUsers: (v: boolean) => void,
  setAllowRegistration: (v: boolean) => void
) {
  return useCallback(() => {
    return fetchAuthStatus()
      .then((status) => {
        setHasUsers(!!status.has_users)
        setAllowRegistration(!!status.allow_registration)
      })
      .catch(() => {
        setHasUsers(false)
        setAllowRegistration(false)
      })
      .then(() => applyAccessToken(setState, setUser))
  }, [setState, setUser, setHasUsers, setAllowRegistration])
}

function applyAccessToken(
  setState: (s: AuthState) => void,
  setUser: (u: AuthUserInfo | null) => void
): Promise<void> | void {
  const token = getAccessToken()
  if (!token) {
    setUser(null)
    setState("unauthenticated")
    return
  }
  return fetchAuthMe().then(
    (me) => {
      if (!me.user) {
        setAccessToken("")
        setUser(null)
        setState("unauthenticated")
        return
      }
      setUser(me.user)
      setState("authenticated")
    },
    () => {
      setAccessToken("")
      setUser(null)
      setState("unauthenticated")
    }
  )
}

function useAuthListeners(
  refresh: () => Promise<void>,
  setUser: (u: AuthUserInfo | null) => void,
  setState: (s: AuthState) => void
) {
  const toast = useToast()
  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast
  }, [toast])
  useEffect(() => {
    const onTokenChange = () => {
      void refresh()
    }
    const onUnauthorized = () => {
      setAccessToken("")
      setUser(null)
      setState("unauthenticated")
      toastRef.current.warning(i18n.t("auth.sessionExpired"))
    }
    window.addEventListener(SERVER_API_KEY_CHANGED, onTokenChange)
    window.addEventListener("auth:unauthorized", onUnauthorized)
    return () => {
      window.removeEventListener(SERVER_API_KEY_CHANGED, onTokenChange)
      window.removeEventListener("auth:unauthorized", onUnauthorized)
    }
  }, [refresh, setUser, setState])
}

export function useAuthSession() {
  const [state, setState] = useState<AuthState>("loading")
  const [user, setUser] = useState<AuthUserInfo | null>(null)
  const [hasUsers, setHasUsers] = useState(false)
  const [allowRegistration, setAllowRegistration] = useState(false)
  const refresh = useAuthRefresh(
    setState,
    setUser,
    setHasUsers,
    setAllowRegistration
  )
  useEffect(() => {
    void refresh()
  }, [refresh])
  useAuthListeners(refresh, setUser, setState)
  const logout = useCallback(() => {
    setAccessToken("")
    setUser(null)
    setState("unauthenticated")
  }, [])
  return { state, user, hasUsers, allowRegistration, logout, refresh }
}
