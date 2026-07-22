/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { useTheme } from "@/components/theme-provider"
import {
  extractDominant,
  loadBackgroundSettings,
  probeBackground,
  removeBackground,
  saveBackgroundSettings,
  uploadBackground,
  BACKGROUND_URL,
  type BackgroundSettings,
} from "@/lib/background"

interface BackgroundContextValue {
  settings: BackgroundSettings
  imageUrl: string | null
  uploading: boolean
  upload: (file: File) => Promise<void>
  remove: () => Promise<void>
  update: (partial: Partial<BackgroundSettings>) => void
}

const BackgroundContext = React.createContext<BackgroundContextValue | undefined>(undefined)

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const { setMode } = useTheme()
  const [settings, setSettings] = React.useState<BackgroundSettings>(() => loadBackgroundSettings())
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)

  const persist = React.useCallback((s: BackgroundSettings) => {
    saveBackgroundSettings(s)
    setSettings(s)
  }, [])

  // Auto-adapt: switch light/dark based on the image's average luminance only.
  // A complex (non-solid) image's dominant hue makes an arbitrary accent, so
  // we no longer recolor the theme — only the mode adapts.
  const runAdapt = React.useCallback(async (url: string) => {
    const result = await extractDominant(url)
    if (!result) return
    setMode(result.luminance < 0.5 ? "dark" : "light")
  }, [setMode])

  // On mount: probe backend for an existing background image.
  React.useEffect(() => {
    let active = true
    probeBackground().then((exists) => {
      if (!active) return
      if (exists) {
        const url = `${BACKGROUND_URL}?t=${Date.now()}`
        setImageUrl(url)
        setSettings((prev) => {
          const next = { ...prev, hasImage: true }
          saveBackgroundSettings(next)
          if (next.autoAdapt && next.enabled) void runAdapt(url)
          return next
        })
      } else {
        setSettings((prev) => {
          const next = { ...prev, hasImage: false }
          saveBackgroundSettings(next)
          return next
        })
      }
    })
    return () => { active = false }
  }, [runAdapt])

  // Toggle a root class so CSS can make major surfaces translucent over the
  // background image (sidebar, cards, menus, input area, etc.).
  React.useEffect(() => {
    document.documentElement.classList.toggle("has-bg", settings.enabled && settings.hasImage)
  }, [settings.enabled, settings.hasImage])

  const upload = React.useCallback(async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadBackground(file)
      setImageUrl(url)
      const next: BackgroundSettings = { ...settings, hasImage: true, enabled: true }
      persist(next)
      if (next.autoAdapt) await runAdapt(url)
    } finally {
      setUploading(false)
    }
  }, [settings, persist, runAdapt])

  const remove = React.useCallback(async () => {
    await removeBackground()
    setImageUrl(null)
    persist({ ...settings, hasImage: false, enabled: false })
  }, [settings, persist])

  const update = React.useCallback((partial: Partial<BackgroundSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial }
      saveBackgroundSettings(next)
      if (partial.autoAdapt === true && next.enabled && imageUrl) {
        void runAdapt(imageUrl)
      }
      return next
    })
  }, [imageUrl, runAdapt])

  const value = React.useMemo<BackgroundContextValue>(() => ({
    settings, imageUrl, uploading, upload, remove, update,
  }), [settings, imageUrl, uploading, upload, remove, update])

  return <BackgroundContext.Provider value={value}>{children}</BackgroundContext.Provider>
}

export function useBackground() {
  const ctx = React.useContext(BackgroundContext)
  if (!ctx) throw new Error("useBackground must be used within BackgroundProvider")
  return ctx
}
