import i18n from "@/i18n"
import { apiHeaders, getAccessToken } from "@/lib/api"

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

/** Kind of media stored as the background. */
export type BackgroundMediaKind = "image" | "video"

/** Background image/video URL served by the backend. */
export const BACKGROUND_URL = "/v1/background"

/** Background URL with optional access_token query for <img>/<video>/CSS when auth is on. */
export function backgroundImageURL(cacheBust?: number): string {
  const params = new URLSearchParams()
  const token = getAccessToken()
  if (token) params.set("access_token", token)
  if (cacheBust) params.set("t", String(cacheBust))
  const qs = params.toString()
  return qs ? `${BACKGROUND_URL}?${qs}` : BACKGROUND_URL
}

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

/** Probes the backend for a stored background; resolves to its media kind, or null if absent. */
export async function probeBackground(): Promise<BackgroundMediaKind | null> {
  try {
    const res = await fetch(BACKGROUND_URL, { method: "HEAD", headers: apiHeaders() })
    if (!res.ok) return null
    return (res.headers.get("Content-Type") ?? "").startsWith("video/") ? "video" : "image"
  } catch {
    return null
  }
}

/** Uploads an image or video file as the background; returns the cache-busted URL and media kind. */
export async function uploadBackground(file: File): Promise<{ url: string; kind: BackgroundMediaKind }> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(BACKGROUND_URL, {
    method: "POST",
    body: form,
    headers: apiHeaders({ Accept: "application/json" }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message ?? i18n.t("api.backgroundUploadFailed", { status: res.status }))
  }
  return {
    url: backgroundImageURL(Date.now()),
    kind: file.type.startsWith("video/") ? "video" : "image",
  }
}

/** Removes the stored background image. */
export async function removeBackground(): Promise<void> {
  await fetch(BACKGROUND_URL, { method: "DELETE", headers: apiHeaders() })
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

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function loadVideoFrame(url: string): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.muted = true
    video.preload = "auto"
    video.onloadeddata = () => resolve(video)
    video.onerror = () => resolve(null)
    video.src = url
  })
}

/** Loads the media and extracts its dominant color + average luminance via canvas. */
export async function extractDominant(mediaUrl: string, kind: BackgroundMediaKind = "image"): Promise<AdaptResult | null> {
  const source = kind === "video" ? await loadVideoFrame(mediaUrl) : await loadImage(mediaUrl)
  if (!source) return null
  if (source instanceof HTMLImageElement && source.naturalWidth === 0) return null

  const size = 64
  const canvas = document.createElement("canvas")
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, size, size)
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
