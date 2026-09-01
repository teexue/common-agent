import { FileText, X } from "lucide-react"
import { ConstrainedImage } from "./constrained-image"
import type { FileAttachment } from "@/types/agent"

export function InputBarAttachments({
  attachments,
  onRemove,
}: {
  attachments: FileAttachment[]
  onRemove: (index: number) => void
}) {
  if (attachments.length === 0) return null
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {attachments.map((item, i) => (
        <AttachmentPreview
          key={`${item.kind}-${item.name}-${i}`}
          item={item}
          onRemove={() => onRemove(i)}
        />
      ))}
    </div>
  )
}

function AttachmentPreview({
  item,
  onRemove,
}: {
  item: FileAttachment
  onRemove: () => void
}) {
  return (
    <div className="group relative">
      {item.kind === "image" ? (
        <ConstrainedImage
          src={item.dataUrl}
          alt={item.name}
          minSide={64}
          className="rounded-lg border border-border"
        />
      ) : (
        <span className="inline-flex max-w-[200px] items-center gap-1.5 rounded-lg border border-border bg-muted px-2 py-1 text-xs">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{item.name}</span>
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
