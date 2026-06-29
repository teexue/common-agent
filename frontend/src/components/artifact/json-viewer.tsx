import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/shared/copy-button"
import { formatJson } from "@/lib/format"

interface JsonViewerProps {
  data: unknown
  title?: string
}

function KeyPrefix({ keyName }: { keyName?: string }) {
  if (keyName === undefined) return null
  return <><span className="text-primary/80">"{keyName}"</span><span className="text-muted-foreground">: </span></>
}

function ExpandableBlock({ keyName, open, onToggle, bracket, countLabel, children }: {
  keyName?: string; open: boolean; onToggle: () => void; bracket: string; countLabel: string; children: React.ReactNode
}) {
  return (
    <div>
      <Button variant="ghost" size="sm" className="h-auto gap-1 p-0 text-xs hover:bg-transparent" onClick={onToggle}>
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <KeyPrefix keyName={keyName} />
        <span className="text-muted-foreground">{bracket}</span>
        {!open && <span className="text-muted-foreground"> {countLabel} </span>}
        {!open && <span className="text-muted-foreground">{bracket === "[" ? "]" : "}"}</span>}
      </Button>
      {open && <div className="ml-4 border-l border-border pl-2">{children}</div>}
      {open && <span className="text-muted-foreground">{bracket === "[" ? "]" : "}"}</span>}
    </div>
  )
}

function JsonNode({ keyName, value, depth }: { keyName?: string; value: unknown; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2)

  if (value === null) return <span><KeyPrefix keyName={keyName} /><span className="text-muted-foreground">null</span></span>
  if (typeof value === "boolean") return <span><KeyPrefix keyName={keyName} /><span className="text-amber-600 dark:text-amber-400">{String(value)}</span></span>
  if (typeof value === "number") return <span><KeyPrefix keyName={keyName} /><span className="text-cyan-600 dark:text-cyan-400">{value}</span></span>
  if (typeof value === "string") {
    const display = value.length > 100 ? value.slice(0, 100) + "..." : value
    return <span><KeyPrefix keyName={keyName} /><span className="text-success">"{display}"</span></span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span><KeyPrefix keyName={keyName} /><span className="text-muted-foreground">[]</span></span>
    return (
      <ExpandableBlock keyName={keyName} open={expanded} onToggle={() => setExpanded(!expanded)} bracket="[" countLabel={`${value.length} items`}>
        {value.map((item, i) => <div key={i}><JsonNode value={item} depth={depth + 1} />{i < value.length - 1 && <span className="text-muted-foreground">,</span>}</div>)}
      </ExpandableBlock>
    )
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span><KeyPrefix keyName={keyName} /><span className="text-muted-foreground">{"{}"}</span></span>
    return (
      <ExpandableBlock keyName={keyName} open={expanded} onToggle={() => setExpanded(!expanded)} bracket="{" countLabel={`${entries.length} keys`}>
        {entries.map(([k, v], i) => <div key={k}><JsonNode keyName={k} value={v} depth={depth + 1} />{i < entries.length - 1 && <span className="text-muted-foreground">,</span>}</div>)}
      </ExpandableBlock>
    )
  }

  return <span>{String(value)}</span>
}

export function JsonViewer({ data, title }: JsonViewerProps) {
  const formatted = formatJson(data)
  return (
    <div className="relative">
      <div className="mb-1.5 flex items-center justify-between">
        {title && <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>}
        <CopyButton text={formatted} />
      </div>
      <pre className="overflow-auto rounded-xl border border-border bg-card p-3 font-mono text-xs leading-5"><JsonNode value={data} depth={0} /></pre>
    </div>
  )
}
