import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBackground } from "@/components/background/background-provider"

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-muted/40"
    >
      <span className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}>
        <span className={`h-3 w-3 rounded-full bg-background transition-transform ${checked ? "translate-x-3" : ""}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{hint}</span>}
      </span>
    </button>
  )
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] text-foreground">{Math.round(value * (unit === "px" ? 1 : 100)) / (unit === "px" ? 1 : 100)}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
    </div>
  )
}

/** Background image settings: upload, opacity, blur, enable, auto-adapt. */
export function BackgroundPanel() {
  const { t } = useTranslation()
  const { settings, imageUrl, uploading, upload, remove, update } = useBackground()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePick = () => fileRef.current?.click()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setError(null)
    try {
      await upload(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t("settings.backgroundHint")}</p>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {settings.hasImage && imageUrl ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="relative h-28 bg-muted">
            <img src={imageUrl} alt="background" className="h-full w-full object-cover" />
            <div className="absolute right-2 top-2 flex gap-1">
              <Button variant="secondary" size="icon-xs" className="h-7 w-7 rounded-lg bg-background/80 backdrop-blur" onClick={handlePick} disabled={uploading}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="secondary" size="icon-xs" className="h-7 w-7 rounded-lg bg-background/80 text-destructive backdrop-blur hover:bg-destructive/10" onClick={remove} disabled={uploading}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-6 text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
          <span className="text-xs">{uploading ? t("settings.backgroundUpload") : t("settings.backgroundUpload")}</span>
        </button>
      )}

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      {settings.hasImage && (
        <>
          <Toggle
            checked={settings.enabled}
            onChange={(v) => update({ enabled: v })}
            label={t("settings.backgroundEnable")}
          />

          {settings.enabled && (
            <div className="space-y-3 rounded-xl border border-border bg-card px-3.5 py-3">
              <Slider
                label={t("settings.backgroundOpacity")}
                value={settings.opacity}
                min={0.1} max={1} step={0.05} unit=""
                onChange={(v) => update({ opacity: v })}
              />
              <Slider
                label={t("settings.backgroundBlur")}
                value={settings.blur}
                min={0} max={24} step={1} unit="px"
                onChange={(v) => update({ blur: v })}
              />
            </div>
          )}

          <Toggle
            checked={settings.autoAdapt}
            onChange={(v) => update({ autoAdapt: v })}
            label={t("settings.backgroundAdapt")}
            hint={t("settings.backgroundAdaptHint")}
          />
        </>
      )}
    </div>
  )
}
