import { File, Folder } from "lucide-react"
import { str, num, formatSize } from "@/components/inspector/tool-detail-utils"
import { Note, PathLine, type ToolRenderProps } from "./inline-tool-primitives"

interface DirEntry {
  name?: string
  size?: number
  is_dir?: boolean
}

export function ListDirectory({ input, output }: ToolRenderProps) {
  const entries = Array.isArray(output?.entries)
    ? (output.entries as DirEntry[])
    : []
  const count = num(output?.count)
  return (
    <div className="flex flex-col gap-1.5">
      <PathLine path={str(input?.path) || str(output?.path)} />
      {count !== null && <Note>{`${count} entries`}</Note>}
      <div className="flex flex-col">
        {entries.map((e, i) => (
          <DirRow key={`${e.name}-${i}`} entry={e} />
        ))}
      </div>
      {output?.truncated === true && <Note tone="warning">truncated</Note>}
    </div>
  )
}

function DirRow({ entry }: { entry: DirEntry }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {entry.is_dir ? (
        <Folder className="h-3 w-3 shrink-0 text-primary" />
      ) : (
        <File className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
        {entry.name}
      </span>
      {typeof entry.size === "number" && !entry.is_dir && (
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {formatSize(entry.size)}
        </span>
      )}
    </div>
  )
}

interface SearchMatch {
  file?: string
  line?: number
  column?: number
  text?: string
}

export function SearchFiles({ input, output }: ToolRenderProps) {
  const matches = Array.isArray(output?.matches)
    ? (output.matches as SearchMatch[])
    : []
  return (
    <div className="flex flex-col gap-1.5">
      <PathLine
        path={`${str(input?.pattern)}  —  ${str(input?.path) || str(output?.path)}`}
      />
      {num(output?.count) !== null && (
        <Note>{`${num(output?.count)} matches`}</Note>
      )}
      <div className="flex flex-col gap-1">
        {matches.map((m, i) => (
          <div key={i}>
            <p className="font-mono text-[10px] text-primary">
              {m.file}:{m.line}:{m.column}
            </p>
            <p className="font-mono text-[11px] break-all text-muted-foreground">
              {m.text}
            </p>
          </div>
        ))}
      </div>
      {output?.truncated === true && <Note tone="warning">truncated</Note>}
    </div>
  )
}
