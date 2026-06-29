/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const THEME_VALUES: Theme[] = ["dark", "light", "system"]

const ThemeProviderContext = React.createContext<ThemeProviderState | undefined>(undefined)

function isTheme(value: string | null): value is Theme {
  return value !== null && THEME_VALUES.includes(value as Theme)
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light"
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(document.createTextNode("*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"))
  document.head.appendChild(style)
  return () => { window.getComputedStyle(document.body); requestAnimationFrame(() => requestAnimationFrame(() => style.remove())) }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return !!target.closest("input, textarea, select, [contenteditable='true']")
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme
}

function toggleTheme(current: Theme): Theme {
  if (current === "dark") return "light"
  if (current === "light") return "dark"
  return getSystemTheme() === "dark" ? "light" : "dark"
}

export function ThemeProvider({ children, defaultTheme = "system", storageKey = "theme", disableTransitionOnChange = true, ...props }: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const stored = localStorage.getItem(storageKey)
    return isTheme(stored) ? stored : defaultTheme
  })

  const setTheme = React.useCallback((next: Theme) => { localStorage.setItem(storageKey, next); setThemeState(next) }, [storageKey])

  const applyTheme = React.useCallback((next: Theme) => {
    const root = document.documentElement
    const resolved = resolveTheme(next)
    const restore = disableTransitionOnChange ? disableTransitionsTemporarily() : null
    root.classList.remove("light", "dark"); root.classList.add(resolved)
    restore?.()
  }, [disableTransitionOnChange])

  React.useEffect(() => {
    applyTheme(theme)
    if (theme !== "system") return undefined
    const mq = window.matchMedia(COLOR_SCHEME_QUERY)
    const handler = () => applyTheme("system")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme, applyTheme])

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target) || e.key.toLowerCase() !== "d") return
      setThemeState((current) => { const next = toggleTheme(current); localStorage.setItem(storageKey, next); return next })
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [storageKey])

  React.useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || e.key !== storageKey) return
      setThemeState(isTheme(e.newValue) ? e.newValue : defaultTheme)
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }, [defaultTheme, storageKey])

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeProviderContext.Provider {...props} value={value}>{children}</ThemeProviderContext.Provider>
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider")
  return context
}
