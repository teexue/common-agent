import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BackgroundMediaKind } from "@/lib/background"

function PreviewActions({
  uploading,
  onPick,
  onRemove,
}: {
  uploading: boolean
  onPick: () => void
  onRemove: () => void
}) {
  return (
    <div className="absolute top-2 right-2 flex gap-1">
      <Button
        variant="secondary"
        size="icon-xs"
        className="h-7 w-7 rounded-lg bg-background/80 backdrop-blur"
        onClick={onPick}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="secondary"
        size="icon-xs"
        className="h-7 w-7 rounded-lg bg-background/80 text-destructive backdrop-blur hover:bg-destructive/10"
        onClick={onRemove}
        disabled={uploading}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function BackgroundPreview({
  imageUrl,
  mediaKind,
  uploading,
  onPick,
  onRemove,
}: {
  imageUrl: string
  mediaKind: BackgroundMediaKind | null
  uploading: boolean
  onPick: () => void
  onRemove: () => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="relative h-28 bg-muted">
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
          <img
            src={imageUrl}
            alt="background"
            className="h-full w-full object-cover"
          />
        )}
        <PreviewActions
          uploading={uploading}
          onPick={onPick}
          onRemove={onRemove}
        />
      </div>
    </div>
  )
}

export function BackgroundUploadButton({
  uploading,
  label,
  onPick,
}: {
  uploading: boolean
  label: string
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={uploading}
      className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-6 text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
    >
      {uploading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <ImageIcon className="h-5 w-5" />
      )}
      <span className="text-xs">{label}</span>
    </button>
  )
}
