import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

function KeyPrefix({ keyName }: { keyName?: string }) {
  if (keyName === undefined) return null
  return (
    <>
      <span className="text-primary/80">"{keyName}"</span>
      <span className="text-muted-foreground">: </span>
    </>
  )
}

function ExpandableBlock({
  keyName,
  open,
  onToggle,
  bracket,
  countLabel,
  children,
}: {
  keyName?: string
  open: boolean
  onToggle: () => void
  bracket: string
  countLabel: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto gap-1 p-0 text-xs hover:bg-transparent"
        onClick={onToggle}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <KeyPrefix keyName={keyName} />
        <span className="text-muted-foreground">{bracket}</span>
        {!open && <span className="text-muted-foreground"> {countLabel} </span>}
        {!open && (
          <span className="text-muted-foreground">
            {bracket === "[" ? "]" : "}"}
          </span>
        )}
      </Button>
      {open && (
        <div className="ml-4 border-l border-border pl-2">{children}</div>
      )}
      {open && (
        <span className="text-muted-foreground">
          {bracket === "[" ? "]" : "}"}
        </span>
      )}
    </div>
  )
}

function JsonPrimitive({
  keyName,
  value,
}: {
  keyName?: string
  value: unknown
}) {
  if (value === null)
    return (
      <span>
        <KeyPrefix keyName={keyName} />
        <span className="text-muted-foreground">null</span>
      </span>
    )
  if (typeof value === "boolean")
    return (
      <span>
        <KeyPrefix keyName={keyName} />
        <span className="text-warning">{String(value)}</span>
      </span>
    )
  if (typeof value === "number")
    return (
      <span>
        <KeyPrefix keyName={keyName} />
        <span className="text-cyan-600 dark:text-cyan-400">{value}</span>
      </span>
    )
  if (typeof value === "string") {
    const display = value.length > 100 ? value.slice(0, 100) + "..." : value
    return (
      <span>
        <KeyPrefix keyName={keyName} />
        <span className="text-success">"{display}"</span>
      </span>
    )
  }
  return <span>{String(value)}</span>
}

function JsonArray({
  keyName,
  value,
  depth,
  open,
  onToggle,
}: {
  keyName?: string
  value: unknown[]
  depth: number
  open: boolean
  onToggle: () => void
}) {
  if (value.length === 0)
    return (
      <span>
        <KeyPrefix keyName={keyName} />
        <span className="text-muted-foreground">[]</span>
      </span>
    )
  return (
    <ExpandableBlock
      keyName={keyName}
      open={open}
      onToggle={onToggle}
      bracket="["
      countLabel={`${value.length} items`}
    >
      {value.map((item, i) => (
        <div key={i}>
          <JsonNode value={item} depth={depth + 1} />
          {i < value.length - 1 && (
            <span className="text-muted-foreground">,</span>
          )}
        </div>
      ))}
    </ExpandableBlock>
  )
}

function JsonObject({
  keyName,
  value,
  depth,
  open,
  onToggle,
}: {
  keyName?: string
  value: Record<string, unknown>
  depth: number
  open: boolean
  onToggle: () => void
}) {
  const entries = Object.entries(value)
  if (entries.length === 0)
    return (
      <span>
        <KeyPrefix keyName={keyName} />
        <span className="text-muted-foreground">{"{}"}</span>
      </span>
    )
  return (
    <ExpandableBlock
      keyName={keyName}
      open={open}
      onToggle={onToggle}
      bracket="{"
      countLabel={`${entries.length} keys`}
    >
      {entries.map(([k, v], i) => (
        <div key={k}>
          <JsonNode keyName={k} value={v} depth={depth + 1} />
          {i < entries.length - 1 && (
            <span className="text-muted-foreground">,</span>
          )}
        </div>
      ))}
    </ExpandableBlock>
  )
}

export function JsonNode({
  keyName,
  value,
  depth,
}: {
  keyName?: string
  value: unknown
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const toggle = () => setExpanded(!expanded)
  if (value === null || typeof value !== "object")
    return <JsonPrimitive keyName={keyName} value={value} />
  if (Array.isArray(value))
    return (
      <JsonArray
        keyName={keyName}
        value={value}
        depth={depth}
        open={expanded}
        onToggle={toggle}
      />
    )
  return (
    <JsonObject
      keyName={keyName}
      value={value as Record<string, unknown>}
      depth={depth}
      open={expanded}
      onToggle={toggle}
    />
  )
}
