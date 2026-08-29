import * as React from "react"

export type ThemeMode = "dark" | "light" | "system"
export type ThemePalette = "warm" | "slate"
type ResolvedMode = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultMode?: ThemeMode
  defaultPalette?: ThemePalette
  modeKey?: string
  paletteKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  /** Legacy alias for mode. */
  theme: ThemeMode
  setTheme: (mode: ThemeMode) => void
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  palette: ThemePalette
  setPalette: (palette: ThemePalette) => void
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const MODE_VALUES: ThemeMode[] = ["dark", "light", "system"]
const PALETTE_VALUES: ThemePalette[] = ["warm", "slate"]

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function isMode(value: string | null): value is ThemeMode {
  return value !== null && MODE_VALUES.includes(value as ThemeMode)
}

function isPalette(value: string | null): value is ThemePalette {
  return value !== null && PALETTE_VALUES.includes(value as ThemePalette)
}

function getSystemMode(): ResolvedMode {
  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light"
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)
  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => requestAnimationFrame(() => style.remove()))
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return !!target.closest("input, textarea, select, [contenteditable='true']")
}

function resolveMode(mode: ThemeMode): ResolvedMode {
  return mode === "system" ? getSystemMode() : mode
}

function toggleMode(current: ThemeMode): ThemeMode {
  if (current === "dark") return "light"
  if (current === "light") return "dark"
  return getSystemMode() === "dark" ? "light" : "dark"
}

function readStored<T extends string>(
  key: string,
  fallback: T,
  guard: (value: string | null) => value is T
): T {
  try {
    const stored = localStorage.getItem(key)
    return guard(stored) ? stored : fallback
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore quota / private mode errors
  }
}

function applyTheme(
  nextMode: ThemeMode,
  nextPalette: ThemePalette,
  disableTransition: boolean
) {
  const root = document.documentElement
  const resolved = resolveMode(nextMode)
  const restore = disableTransition ? disableTransitionsTemporarily() : null
  root.classList.remove("light", "dark", "theme-slate")
  if (nextPalette === "slate") root.classList.add("theme-slate")
  root.classList.add(resolved)
  restore?.()
}

function useThemeMode(modeKey: string, defaultMode: ThemeMode) {
  const [mode, setModeState] = React.useState<ThemeMode>(() =>
    readStored(modeKey, defaultMode, isMode)
  )
  const setMode = React.useCallback(
    (next: ThemeMode) => {
      writeStored(modeKey, next)
      setModeState(next)
    },
    [modeKey]
  )
  return { mode, setMode, setModeState }
}

function useThemePalette(paletteKey: string, defaultPalette: ThemePalette) {
  const [palette, setPaletteState] = React.useState<ThemePalette>(() =>
    readStored(paletteKey, defaultPalette, isPalette)
  )
  const setPalette = React.useCallback(
    (next: ThemePalette) => {
      writeStored(paletteKey, next)
      setPaletteState(next)
    },
    [paletteKey]
  )
  return { palette, setPalette, setPaletteState }
}

function useApplyTheme(
  mode: ThemeMode,
  palette: ThemePalette,
  disableTransitionOnChange: boolean
) {
  React.useEffect(() => {
    applyTheme(mode, palette, disableTransitionOnChange)
    if (mode !== "system") return undefined
    const mq = window.matchMedia(COLOR_SCHEME_QUERY)
    const handler = () =>
      applyTheme("system", palette, disableTransitionOnChange)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [mode, palette, disableTransitionOnChange])
}

function shouldIgnoreThemeHotkey(e: KeyboardEvent) {
  return (
    e.repeat ||
    e.metaKey ||
    e.ctrlKey ||
    e.altKey ||
    isEditableTarget(e.target) ||
    !!document.querySelector('[role="dialog"]') ||
    e.key.toLowerCase() !== "d"
  )
}

function useThemeHotkey(
  modeKey: string,
  setModeState: React.Dispatch<React.SetStateAction<ThemeMode>>
) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (shouldIgnoreThemeHotkey(e)) return
      setModeState((current) => {
        const next = toggleMode(current)
        localStorage.setItem(modeKey, next)
        return next
      })
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [modeKey, setModeState])
}

function useThemeStorageSync(opts: {
  modeKey: string
  paletteKey: string
  defaultMode: ThemeMode
  defaultPalette: ThemePalette
  setModeState: React.Dispatch<React.SetStateAction<ThemeMode>>
  setPaletteState: React.Dispatch<React.SetStateAction<ThemePalette>>
}) {
  const {
    modeKey,
    paletteKey,
    defaultMode,
    defaultPalette,
    setModeState,
    setPaletteState,
  } = opts
  React.useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return
      if (e.key === modeKey)
        setModeState(isMode(e.newValue) ? e.newValue : defaultMode)
      if (e.key === paletteKey)
        setPaletteState(isPalette(e.newValue) ? e.newValue : defaultPalette)
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }, [
    defaultMode,
    defaultPalette,
    modeKey,
    paletteKey,
    setModeState,
    setPaletteState,
  ])
}

export function ThemeProvider({
  children,
  defaultMode = "system",
  defaultPalette = "warm",
  modeKey = "theme",
  paletteKey = "theme-palette",
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  const { mode, setMode, setModeState } = useThemeMode(modeKey, defaultMode)
  const { palette, setPalette, setPaletteState } = useThemePalette(
    paletteKey,
    defaultPalette
  )
  useApplyTheme(mode, palette, disableTransitionOnChange)
  useThemeHotkey(modeKey, setModeState)
  useThemeStorageSync({
    modeKey,
    paletteKey,
    defaultMode,
    defaultPalette,
    setModeState,
    setPaletteState,
  })
  const value = React.useMemo<ThemeProviderState>(
    () => ({
      theme: mode,
      setTheme: setMode,
      mode,
      setMode,
      palette,
      setPalette,
    }),
    [mode, setMode, palette, setPalette]
  )
  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")
  return context
}
