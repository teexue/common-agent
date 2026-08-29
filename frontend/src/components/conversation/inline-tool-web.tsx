import { cn } from "@/lib/utils"
import { str, num, formatSize } from "@/components/inspector/tool-detail-utils"
import {
  CodeBlock,
  Label,
  Note,
  PathLine,
  type ToolRenderProps,
} from "./inline-tool-primitives"

export function WebFetch({ input, output }: ToolRenderProps) {
  const status = num(output?.status)
  const body = str(output?.body)
  return (
    <div className="flex flex-col gap-1.5">
      <PathLine path={str(input?.url) || str(output?.url)} />
      {status !== null && (
        <span
          className={cn(
            "font-mono text-[11px]",
            status < 400 ? "text-success" : "text-destructive"
          )}
        >
          HTTP {status}
        </span>
      )}
      {body && (
        <div className="flex flex-col gap-1">
          <Label>{`body (${formatSize(num(output?.body_bytes) ?? body.length)})`}</Label>
          <CodeBlock text={body} />
        </div>
      )}
      {output?.truncated === true && <Note tone="warning">truncated</Note>}
    </div>
  )
}
