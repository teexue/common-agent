import { useBackground } from "@/components/background/background-provider"

/**
 * Fixed full-viewport background layer rendered behind the app. Shows the
 * stored image, or plays the stored video (mp4/webm) as an animated
 * wallpaper. Applies user-controlled opacity and blur. Sits at -z-10 so all
 * app surfaces paint above it.
 */
export function BackgroundLayer() {
  const { settings, imageUrl, mediaKind } = useBackground()
  if (!settings.enabled || !settings.hasImage || !imageUrl) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        opacity: settings.opacity,
        filter: settings.blur > 0 ? `blur(${settings.blur}px)` : undefined,
        // Keep blurred edges from showing the page edge: scale slightly.
        transform: settings.blur > 0 ? "scale(1.04)" : undefined,
      }}
    >
      {mediaKind === "video" ? (
        <video
          src={imageUrl}
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="h-full w-full bg-cover bg-center"
          style={{ backgroundImage: `url("${imageUrl}")` }}
        />
      )}
    </div>
  )
}
