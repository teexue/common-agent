import { CopyButton } from "@/components/shared/copy-button"
import { formatJson } from "@/lib/format"
import { JsonNode } from "./json-node"

interface JsonViewerProps {
  data: unknown
  title?: string
}

export function JsonViewer({ data, title }: JsonViewerProps) {
  const formatted = formatJson(data)
  return (
    <div className="relative">
      <div className="mb-1.5 flex items-center justify-between">
        {title && (
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {title}
          </span>
        )}
        <CopyButton text={formatted} />
      </div>
      <pre className="overflow-auto rounded-xl border border-border bg-card p-3 font-mono text-xs leading-5 break-all">
        <JsonNode value={data} depth={0} />
      </pre>
    </div>
  )
}
