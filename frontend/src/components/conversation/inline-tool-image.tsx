import { Image as ImageIcon } from "lucide-react"
import { formatSize, num, str } from "@/components/inspector/tool-detail-utils"
import type { Rec } from "@/components/inspector/tool-detail-utils"
import { ConstrainedImage } from "./constrained-image"
import { FilePanel, Meta, type ToolRenderProps } from "./inline-tool-primitives"

export function ReadImage({ input, output }: ToolRenderProps) {
  const path = str(input?.path) || str(output?.path)
  const preview = str(output?.data_url)
  return (
    <FilePanel path={path} icon={ImageIcon} meta={imageMeta(input, output)}>
      <div className="px-2.5 py-2">
        <ImagePreview path={path} preview={preview} />
      </div>
    </FilePanel>
  )
}

function imageMeta(input: Rec | null, output: Rec | null) {
  const path = str(input?.path) || str(output?.path)
  const mediaType = str(output?.media_type)
  const bytes = num(output?.bytes)
  const detail = str(output?.detail) || str(input?.detail) || "auto"
  const kind = mediaType.replace(/^image\//, "") || extOf(path)
  return (
    <>
      {kind ? <Meta>{kind}</Meta> : null}
      {bytes !== null ? <Meta>{formatSize(bytes)}</Meta> : null}
      <Meta>{detail}</Meta>
    </>
  )
}

function ImagePreview({ path, preview }: { path: string; preview: string }) {
  if (preview) {
    return (
      <ConstrainedImage
        src={preview}
        alt={path || "image"}
        minSide={96}
        className="rounded-md border border-border/70"
      />
    )
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/50">
      <ImageIcon className="h-5 w-5 text-muted-foreground" />
    </div>
  )
}

function extOf(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? ""
  const i = base.lastIndexOf(".")
  return i >= 0 ? base.slice(i + 1).toLowerCase() : ""
}
