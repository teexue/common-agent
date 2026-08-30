import { useTranslation } from "react-i18next"
import { SettingsToggle } from "./settings-toggle"

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  const scaled =
    Math.round(value * (unit === "px" ? 1 : 100)) / (unit === "px" ? 1 : 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] text-foreground">
          {scaled}
          {unit}
        </span>
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

export function BackgroundEnableToggle({
  enabled,
  onUpdate,
}: {
  enabled: boolean
  onUpdate: (partial: { enabled: boolean }) => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsToggle
      checked={enabled}
      onChange={(v) => onUpdate({ enabled: v })}
      label={t("settings.backgroundEnable")}
    />
  )
}

export function BackgroundAdaptToggle({
  autoAdapt,
  onUpdate,
}: {
  autoAdapt: boolean
  onUpdate: (partial: { autoAdapt: boolean }) => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsToggle
      checked={autoAdapt}
      onChange={(v) => onUpdate({ autoAdapt: v })}
      label={t("settings.backgroundAdapt")}
      hint={t("settings.backgroundAdaptHint")}
    />
  )
}

export function BackgroundSliders({
  opacity,
  blur,
  onUpdate,
}: {
  opacity: number
  blur: number
  onUpdate: (partial: { opacity?: number; blur?: number }) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3 rounded-xl bg-muted/50 px-3.5 py-3">
      <Slider
        label={t("settings.backgroundOpacity")}
        value={opacity}
        min={0.1}
        max={1}
        step={0.05}
        unit=""
        onChange={(v) => onUpdate({ opacity: v })}
      />
      <Slider
        label={t("settings.backgroundBlur")}
        value={blur}
        min={0}
        max={24}
        step={1}
        unit="px"
        onChange={(v) => onUpdate({ blur: v })}
      />
    </div>
  )
}
