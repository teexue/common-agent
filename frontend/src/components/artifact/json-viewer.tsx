import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/shared/copy-button"
import { formatJson } from "@/lib/format"

interface JsonViewerProps {
  data: unknown
  title?: string
}

function JsonNode({
  keyName,
  value,
  depth,
}: {
  keyName?: string
  value: unknown
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth < 2)

  const keySpan = keyName !== undefined && (
    <span className="text-primary/80">"{keyName}"</span>
  )

  if (value === null) {
    return (
      <span>
        {keySpan}
        {keyName !== undefined && <span className="text-muted-foreground">: </span>}
        <span className="text-muted-foreground">null</span>
      </span>
    )
  }

  if (typeof value === "boolean") {
    return (
      <span>
        {keySpan}
        {keyName !== undefined && <span className="text-muted-foreground">: </span>}
        <span className="text-amber-600 dark:text-amber-400">
          {String(value)}
        </span>
      </span>
    )
  }

  if (typeof value === "number") {
    return (
      <span>
        {keySpan}
        {keyName !== undefined && <span className="text-muted-foreground">: </span>}
        <span className="text-cyan-600 dark:text-cyan-400">{value}</span>
      </span>
    )
  }

  if (typeof value === "string") {
    const display = value.length > 100 ? value.slice(0, 100) + "..." : value
    return (
      <span>
        {keySpan}
        {keyName !== undefined && <span className="text-muted-foreground">: </span>}
        <span className="text-success">
          "{display}"
        </span>
      </span>
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span>
          {keySpan}
          {keyName !== undefined && <span className="text-muted-foreground">: </span>}
          <span className="text-muted-foreground">[]</span>
        </span>
      )
    }

    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto gap-1 p-0 text-xs hover:bg-transparent"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          {keySpan}
          {keyName !== undefined && <span className="text-muted-foreground">: </span>}
          <span className="text-muted-foreground">[</span>
          {!expanded && (
            <span className="text-muted-foreground"> {value.length} items </span>
          )}
          {!expanded && <span className="text-muted-foreground">]</span>}
        </Button>
        {expanded && (
          <div className="ml-4 border-l border-border pl-2">
            {value.map((item, i) => (
              <div key={i}>
                <JsonNode value={item} depth={depth + 1} />
                {i < value.length - 1 && (
                  <span className="text-muted-foreground">,</span>
                )}
              </div>
            ))}
          </div>
        )}
        {expanded && <span className="text-muted-foreground">]</span>}
      </div>
    )
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      return (
        <span>
          {keySpan}
          {keyName !== undefined && <span className="text-muted-foreground">: </span>}
          <span className="text-muted-foreground">{"{}"}</span>
        </span>
      )
    }

    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto gap-1 p-0 text-xs hover:bg-transparent"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          {keySpan}
          {keyName !== undefined && <span className="text-muted-foreground">: </span>}
          <span className="text-muted-foreground">{"{"}</span>
          {!expanded && (
            <span className="text-muted-foreground"> {entries.length} keys </span>
          )}
          {!expanded && <span className="text-muted-foreground">{"}"}</span>}
        </Button>
        {expanded && (
          <div className="ml-4 border-l border-border pl-2">
            {entries.map(([k, v], i) => (
              <div key={k}>
                <JsonNode keyName={k} value={v} depth={depth + 1} />
                {i < entries.length - 1 && (
                  <span className="text-muted-foreground">,</span>
                )}
              </div>
            ))}
          </div>
        )}
        {expanded && <span className="text-muted-foreground">{"}"}</span>}
      </div>
    )
  }

  return <span>{String(value)}</span>
}

export function JsonViewer({ data, title }: JsonViewerProps) {
  const formatted = formatJson(data)

  return (
    <div className="relative">
      <div className="mb-1.5 flex items-center justify-between">
        {title && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        )}
        <CopyButton text={formatted} />
      </div>
      <pre className="overflow-auto rounded-xl border border-border bg-card p-3 font-mono text-xs leading-5">
        <JsonNode value={data} depth={0} />
      </pre>
    </div>
  )
}
