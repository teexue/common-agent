import { X } from "lucide-react"
import type { ImageAttachment } from "./input-bar"

export function InputBarImages({
  images,
  onRemove,
}: {
  images: ImageAttachment[]
  onRemove: (index: number) => void
}) {
  if (images.length === 0) return null
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {images.map((img, i) => (
        <div
          key={i}
          className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border"
        >
          <img
            src={img.dataUrl}
            alt={img.name}
            className="h-full w-full object-cover"
          />
          <button
            onClick={() => onRemove(i)}
            className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
