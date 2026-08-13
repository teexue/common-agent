import { useEffect, useState } from "react"
import { Navigate, useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"
import { loginUser, registerUser, setAccessToken } from "@/lib/api"

type Mode = "login" | "register"

/** Full-page login / register gate — shown before any app data loads. */
export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { state, hasUsers, allowRegistration, refresh } = useAuth()
  const [mode, setMode] = useState<Mode>(hasUsers ? "login" : "register")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(hasUsers ? "login" : "register")
  }, [hasUsers])

  // Open registration may be disabled by an admin; force login mode then.
  const canRegister = !hasUsers || allowRegistration
  const effectiveMode: Mode =
    mode === "register" && !canRegister ? "login" : mode

  if (state === "loading") {
    return (
      <div className="flex h-full min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    )
  }

  if (state === "authenticated") {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const session =
        effectiveMode === "register"
          ? await registerUser(username, password, displayName)
          : await loginUser(username, password)
      setAccessToken(session.token)
      await refresh()
      navigate("/", { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src="/logo.png"
            alt="common-agent"
            className="h-12 w-12 rounded-xl"
          />
          <div>
            <h1 className="font-heading text-xl tracking-tight text-foreground">
              common-agent
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {effectiveMode === "login"
                ? t("auth.loginHint")
                : t("auth.registerHint")}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          {effectiveMode === "register" && !hasUsers && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-[11px] leading-relaxed text-primary">
              {t("auth.firstUserAdminHint")}
            </p>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("auth.username")}
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-10 rounded-xl font-mono text-sm"
              autoComplete="username"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("auth.password")}
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-xl text-sm"
              autoComplete={
                effectiveMode === "login" ? "current-password" : "new-password"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit()
              }}
            />
          </div>
          {effectiveMode === "register" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("auth.displayName")}
              </Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-10 rounded-xl text-sm"
                autoComplete="nickname"
              />
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button
            className="h-10 w-full text-sm"
            onClick={() => void handleSubmit()}
            disabled={
              saving ||
              !username.trim() ||
              (effectiveMode === "register" ? password.length < 6 : password.length === 0)
            }
          >
            {saving
              ? t("common.loading")
              : effectiveMode === "login"
                ? t("auth.login")
                : t("auth.register")}
          </Button>

          {(canRegister || effectiveMode === "register") && (
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setMode(effectiveMode === "login" ? "register" : "login")
                setError(null)
              }}
            >
              {effectiveMode === "login"
                ? t("auth.switchRegister")
                : t("auth.switchLogin")}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
