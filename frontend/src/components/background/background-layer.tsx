import { useBackground } from "@/components/background/background-provider"

/**
 * Fixed full-viewport background image layer rendered behind the app.
 * Applies user-controlled opacity and blur. Sits at -z-10 so all app
 * surfaces paint above it.
 */
export function BackgroundLayer() {
  const { settings, imageUrl } = useBackground()
  if (!settings.enabled || !settings.hasImage || !imageUrl) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
      style={{
        backgroundImage: `url("${imageUrl}")`,
        opacity: settings.opacity,
        filter: settings.blur > 0 ? `blur(${settings.blur}px)` : undefined,
        // Keep blurred edges from showing the page edge: scale slightly.
        transform: settings.blur > 0 ? "scale(1.04)" : undefined,
      }}
    />
  )
}
