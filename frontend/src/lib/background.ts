import i18n from "@/i18n"

export interface BackgroundSettings {
  enabled: boolean
  opacity: number // 0..1
  blur: number // px
  autoAdapt: boolean
  hasImage: boolean
}

const STORAGE_KEY = "background-settings"

export const DEFAULT_BACKGROUND: BackgroundSettings = {
  enabled: false,
  opacity: 0.6,
  blur: 0,
  autoAdapt: false,
  hasImage: false,
}

/** Background image URL served by the backend. */
export const BACKGROUND_URL = "/v1/background"

export function loadBackgroundSettings(): BackgroundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_BACKGROUND }
    const parsed = JSON.parse(raw) as Partial<BackgroundSettings>
    return { ...DEFAULT_BACKGROUND, ...parsed }
  } catch {
    return { ...DEFAULT_BACKGROUND }
  }
}

export function saveBackgroundSettings(s: BackgroundSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

/** Probes the backend for a stored background image; resolves to true if present. */
export async function probeBackground(): Promise<boolean> {
  try {
    const res = await fetch(BACKGROUND_URL, { method: "HEAD" })
    return res.ok
  } catch {
    return false
  }
}

/** Uploads an image file as the background; returns the cache-busted URL. */
export async function uploadBackground(file: File): Promise<string> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(BACKGROUND_URL, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.backgroundUploadFailed", { status: res.status }))
  }
  return `${BACKGROUND_URL}?t=${Date.now()}`
}

/** Removes the stored background image. */
export async function removeBackground(): Promise<void> {
  await fetch(BACKGROUND_URL, { method: "DELETE" })
}

// ─── Auto-adapt: dominant color extraction + accent injection ──────────────

interface HSL {
  h: number // 0..360
  s: number // 0..1
  l: number // 0..1
}

function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b); const min = Math.min(r, g, b)
  let h = 0
  const l = (max + min) / 2
  const d = max - min
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / d) % 6; break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4; break
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

export interface AdaptResult {
  hsl: HSL
  luminance: number // 0..1 average image luminance
}

/** Loads the image and extracts its dominant color + average luminance via canvas. */
export async function extractDominant(imgUrl: string): Promise<AdaptResult | null> {
  const img = new Image()
  img.crossOrigin = "anonymous"
  img.src = imgUrl
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error("image load failed"))
  }).catch(() => null)
  if (!img.complete || img.naturalWidth === 0) return null

  const size = 64
  const canvas = document.createElement("canvas")
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, size, size)
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, size, size).data
  } catch {
    return null
  }

  const buckets: { h: number; s: number; l: number; weight: number }[] = Array.from({ length: 36 }, () => ({ h: 0, s: 0, l: 0, weight: 0 }))
  let totalLum = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]; const g = data[i + 1]; const b = data[i + 2]; const a = data[i + 3]
    if (a === 0) continue
    const { h, s, l } = rgbToHsl(r, g, b)
    totalLum += l
    count++
    if (s < 0.12) continue // skip near-grey pixels for hue dominance
    const bucket = Math.floor(h / 10) % 36
    const w = buckets[bucket]
    w.h += h; w.s += s; w.l += l; w.weight += s
  }
  if (count === 0) return null

  let best = buckets[0]
  for (const b of buckets) if (b.weight > best.weight) best = b
  if (best.weight === 0) {
    // Image is essentially monochrome — still report its luminance for mode.
    return { hsl: { h: 210, s: 0.1, l: 0.5 }, luminance: totalLum / count }
  }
  return {
    hsl: { h: best.h / best.weight, s: Math.min(best.s / best.weight, 0.85), l: best.l / best.weight },
    luminance: totalLum / count,
  }
}
