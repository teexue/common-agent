import { useState } from "react"
import { cn } from "@/lib/utils"

export function ConstrainedImage({
  src,
  alt,
  minSide = 100,
  className,
}: {
  src: string
  alt: string
  minSide?: number
  className?: string
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  return (
    <img
      src={src}
      alt={alt}
      className={cn("rounded-md object-contain", className)}
      style={
        box
          ? { width: box.w, height: box.h }
          : { height: minSide, width: "auto" }
      }
      onLoad={(e) => setBox(shortSideBox(e.currentTarget, minSide))}
    />
  )
}

function shortSideBox(
  img: HTMLImageElement,
  minSide: number
): { w: number; h: number } {
  const { naturalWidth: nw, naturalHeight: nh } = img
  if (nw >= nh) {
    return { h: minSide, w: Math.max(minSide, Math.round((nw / nh) * minSide)) }
  }
  return { w: minSide, h: Math.max(minSide, Math.round((nh / nw) * minSide)) }
}
