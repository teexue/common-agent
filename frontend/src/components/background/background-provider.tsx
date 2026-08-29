import * as React from "react"
import { useTheme } from "@/components/theme-provider"
import {
  extractDominant,
  loadBackgroundSettings,
  probeBackground,
  removeBackground,
  saveBackgroundSettings,
  uploadBackground,
  backgroundImageURL,
  type BackgroundMediaKind,
  type BackgroundSettings,
} from "@/lib/background"

interface BackgroundContextValue {
  settings: BackgroundSettings
  imageUrl: string | null
  mediaKind: BackgroundMediaKind | null
  uploading: boolean
  upload: (file: File) => Promise<void>
  remove: () => Promise<void>
  update: (partial: Partial<BackgroundSettings>) => void
}

const BackgroundContext = React.createContext<
  BackgroundContextValue | undefined
>(undefined)

interface ProbeApply {
  kind: BackgroundMediaKind | null
  runAdapt: (url: string, kind: BackgroundMediaKind) => Promise<void>
  setImageUrl: (url: string | null) => void
  setMediaKind: (kind: BackgroundMediaKind | null) => void
  setSettings: React.Dispatch<React.SetStateAction<BackgroundSettings>>
}

function applyProbeResult(opts: ProbeApply) {
  if (!opts.kind) {
    opts.setSettings((prev) => {
      const next = { ...prev, hasImage: false }
      saveBackgroundSettings(next)
      return next
    })
    return
  }
  const url = backgroundImageURL(Date.now())
  const kind = opts.kind
  opts.setImageUrl(url)
  opts.setMediaKind(kind)
  opts.setSettings((prev) => {
    const next = { ...prev, hasImage: true }
    saveBackgroundSettings(next)
    if (next.autoAdapt && next.enabled) void opts.runAdapt(url, kind)
    return next
  })
}

function useAdaptToMedia(setMode: (mode: "dark" | "light") => void) {
  return React.useCallback(
    async (url: string, kind: BackgroundMediaKind) => {
      const result = await extractDominant(url, kind)
      if (!result) return
      setMode(result.luminance < 0.5 ? "dark" : "light")
    },
    [setMode]
  )
}

function useBackgroundProbe(opts: Omit<ProbeApply, "kind">) {
  const { runAdapt, setImageUrl, setMediaKind, setSettings } = opts
  React.useEffect(() => {
    let active = true
    probeBackground().then((kind) => {
      if (!active) return
      applyProbeResult({
        kind,
        runAdapt,
        setImageUrl,
        setMediaKind,
        setSettings,
      })
    })
    return () => {
      active = false
    }
  }, [runAdapt, setImageUrl, setMediaKind, setSettings])
}

function useHasBgClass(settings: BackgroundSettings) {
  React.useEffect(() => {
    document.documentElement.classList.toggle(
      "has-bg",
      settings.enabled && settings.hasImage
    )
  }, [settings.enabled, settings.hasImage])
}

function useUploadBackground(opts: {
  settings: BackgroundSettings
  persist: (s: BackgroundSettings) => void
  runAdapt: (url: string, kind: BackgroundMediaKind) => Promise<void>
  setImageUrl: (url: string | null) => void
  setMediaKind: (kind: BackgroundMediaKind | null) => void
  setUploading: (v: boolean) => void
}) {
  const {
    settings,
    persist,
    runAdapt,
    setImageUrl,
    setMediaKind,
    setUploading,
  } = opts
  return React.useCallback(
    async (file: File) => {
      setUploading(true)
      try {
        const { url, kind } = await uploadBackground(file)
        setImageUrl(url)
        setMediaKind(kind)
        const next: BackgroundSettings = {
          ...settings,
          hasImage: true,
          enabled: true,
        }
        persist(next)
        if (next.autoAdapt) await runAdapt(url, kind)
      } finally {
        setUploading(false)
      }
    },
    [settings, persist, runAdapt, setImageUrl, setMediaKind, setUploading]
  )
}

function useRemoveBackground(opts: {
  settings: BackgroundSettings
  persist: (s: BackgroundSettings) => void
  setImageUrl: (url: string | null) => void
  setMediaKind: (kind: BackgroundMediaKind | null) => void
}) {
  const { settings, persist, setImageUrl, setMediaKind } = opts
  return React.useCallback(async () => {
    await removeBackground()
    setImageUrl(null)
    setMediaKind(null)
    persist({ ...settings, hasImage: false, enabled: false })
  }, [settings, persist, setImageUrl, setMediaKind])
}

function useUpdateBackground(opts: {
  imageUrl: string | null
  mediaKind: BackgroundMediaKind | null
  runAdapt: (url: string, kind: BackgroundMediaKind) => Promise<void>
}) {
  const { imageUrl, mediaKind, runAdapt } = opts
  return React.useCallback(
    (partial: Partial<BackgroundSettings>) => {
      return applyUpdate(partial, { imageUrl, mediaKind, runAdapt })
    },
    [imageUrl, mediaKind, runAdapt]
  )
}

function applyUpdate(
  partial: Partial<BackgroundSettings>,
  ctx: {
    imageUrl: string | null
    mediaKind: BackgroundMediaKind | null
    runAdapt: (url: string, kind: BackgroundMediaKind) => Promise<void>
  }
) {
  return (prev: BackgroundSettings) => {
    const next = { ...prev, ...partial }
    saveBackgroundSettings(next)
    if (
      partial.autoAdapt === true &&
      next.enabled &&
      ctx.imageUrl &&
      ctx.mediaKind
    ) {
      void ctx.runAdapt(ctx.imageUrl, ctx.mediaKind)
    }
    return next
  }
}

function useBackgroundModel(): BackgroundContextValue {
  const { setMode } = useTheme()
  const [settings, setSettings] = React.useState<BackgroundSettings>(() =>
    loadBackgroundSettings()
  )
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [mediaKind, setMediaKind] = React.useState<BackgroundMediaKind | null>(
    null
  )
  const [uploading, setUploading] = React.useState(false)
  const persist = React.useCallback((s: BackgroundSettings) => {
    saveBackgroundSettings(s)
    setSettings(s)
  }, [])
  const runAdapt = useAdaptToMedia(setMode)
  useBackgroundProbe({ runAdapt, setImageUrl, setMediaKind, setSettings })
  useHasBgClass(settings)
  const upload = useUploadBackground({
    settings,
    persist,
    runAdapt,
    setImageUrl,
    setMediaKind,
    setUploading,
  })
  const remove = useRemoveBackground({
    settings,
    persist,
    setImageUrl,
    setMediaKind,
  })
  const updater = useUpdateBackground({ imageUrl, mediaKind, runAdapt })
  const update = React.useCallback(
    (partial: Partial<BackgroundSettings>) => {
      setSettings(updater(partial))
    },
    [updater]
  )
  return React.useMemo(
    () => ({
      settings,
      imageUrl,
      mediaKind,
      uploading,
      upload,
      remove,
      update,
    }),
    [settings, imageUrl, mediaKind, uploading, upload, remove, update]
  )
}

export function BackgroundProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const value = useBackgroundModel()
  return (
    <BackgroundContext.Provider value={value}>
      {children}
    </BackgroundContext.Provider>
  )
}

export function useBackground() {
  const ctx = React.useContext(BackgroundContext)
  if (!ctx)
    throw new Error("useBackground must be used within BackgroundProvider")
  return ctx
}
