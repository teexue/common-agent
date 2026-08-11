import { File, Folder } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CodeBlock } from "@/components/artifact/code-block"
import { MarkdownRenderer } from "@/components/shared/markdown-renderer"
import { DiffView } from "./diff-view"
import { addedLines, diffLines } from "./diff-utils"
import { cn } from "@/lib/utils"
import { formatSize, langFromPath, num, str } from "./tool-detail-utils"
import type { Rec } from "./tool-detail-utils"
import { NoteLine, PathRow } from "./tool-detail-rows"

export interface ToolDetailProps {
  input: Rec | null
  output: Rec | null
}

export function RunCommandDetail({ input, output }: ToolDetailProps) {
  const exitCode = num(output?.exit_code)
  const stdout = str(output?.stdout)
  const stderr = str(output?.stderr)
  return (
    <>
      <CodeBlock
        code={`$ ${str(input?.command)}`}
        language="bash"
        title="command"
      />
      {exitCode !== null && (
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "rounded-md px-1.5 py-0 font-mono text-xs",
              exitCode === 0
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            )}
          >
            exit {exitCode}
          </Badge>
          {output?.timed_out === true && (
            <NoteLine tone="warning">timed out</NoteLine>
          )}
        </div>
      )}
      {stdout && <CodeBlock code={stdout} title="stdout" />}
      {stderr && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="mb-1 text-[11px] font-semibold tracking-wider text-destructive uppercase">
            stderr
          </p>
          <pre className="font-mono text-xs leading-5 break-all whitespace-pre-wrap text-destructive">
            {stderr}
          </pre>
        </div>
      )}
    </>
  )
}

export function ReadFileDetail({ input, output }: ToolDetailProps) {
  const path = str(input?.path) || str(output?.path)
  const content = str(output?.content)
  return (
    <>
      <PathRow path={path} />
      {output?.truncated === true && (
        <NoteLine tone="warning">truncated</NoteLine>
      )}
      {content && <CodeBlock code={content} language={langFromPath(path)} />}
    </>
  )
}

export function WriteFileDetail({ input }: ToolDetailProps) {
  const path = str(input?.path)
  const content = str(input?.content)
  return (
    <>
      <PathRow path={path} />
      {content && <DiffView lines={addedLines(content)} />}
    </>
  )
}

export function EditFileDetail({ input, output }: ToolDetailProps) {
  const oldStr = str(input?.old_string)
  const newStr = str(input?.new_string)
  const replacements = num(output?.replacements)
  return (
    <>
      <PathRow path={str(input?.path) || str(output?.path)} />
      {replacements !== null && (
        <NoteLine>{`replacements: ${replacements}`}</NoteLine>
      )}
      <DiffView lines={diffLines(oldStr, newStr)} />
    </>
  )
}

interface DirEntry {
  name?: string
  size?: number
  is_dir?: boolean
}

export function ListDirectoryDetail({ input, output }: ToolDetailProps) {
  const entries = Array.isArray(output?.entries)
    ? (output.entries as DirEntry[])
    : []
  const count = num(output?.count)
  return (
    <>
      <PathRow path={str(input?.path) || str(output?.path)} />
      {count !== null && <NoteLine>{`${count} entries`}</NoteLine>}
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {entries.map((e, i) => (
          <div
            key={`${e.name}-${i}`}
            className="flex items-center gap-2 px-3 py-1.5"
          >
            {e.is_dir ? (
              <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />
            ) : (
              <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
              {e.name}
            </span>
            {typeof e.size === "number" && !e.is_dir && (
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {formatSize(e.size)}
              </span>
            )}
          </div>
        ))}
      </div>
      {output?.truncated === true && (
        <NoteLine tone="warning">truncated</NoteLine>
      )}
    </>
  )
}

interface SearchMatch {
  file?: string
  line?: number
  column?: number
  text?: string
}

export function SearchFilesDetail({ input, output }: ToolDetailProps) {
  const matches = Array.isArray(output?.matches)
    ? (output.matches as SearchMatch[])
    : []
  return (
    <>
      <PathRow
        path={`${str(input?.pattern)}  —  ${str(input?.path) || str(output?.path)}`}
      />
      {num(output?.count) !== null && (
        <NoteLine>{`${num(output?.count)} matches`}</NoteLine>
      )}
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {matches.map((m, i) => (
          <div key={i} className="px-3 py-1.5">
            <p className="font-mono text-[11px] text-primary">
              {m.file}:{m.line}:{m.column}
            </p>
            <p className="mt-0.5 font-mono text-xs break-all text-foreground">
              {m.text}
            </p>
          </div>
        ))}
      </div>
      {output?.truncated === true && (
        <NoteLine tone="warning">truncated</NoteLine>
      )}
    </>
  )
}

export function WebFetchDetail({ input, output }: ToolDetailProps) {
  const status = num(output?.status)
  const body = str(output?.body)
  return (
    <>
      <PathRow path={str(input?.url) || str(output?.url)} />
      {status !== null && (
        <Badge
          variant="secondary"
          className={cn(
            "w-fit rounded-md px-1.5 py-0 font-mono text-xs",
            status < 400
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          )}
        >
          HTTP {status}
        </Badge>
      )}
      {body && (
        <div className="max-h-96 overflow-auto">
          <CodeBlock
            code={body}
            title={`body (${formatSize(num(output?.body_bytes) ?? body.length)})`}
          />
        </div>
      )}
      {output?.truncated === true && (
        <NoteLine tone="warning">truncated</NoteLine>
      )}
    </>
  )
}

export function DelegateTaskDetail({ input, output }: ToolDetailProps) {
  const response = str(output?.response)
  return (
    <>
      {str(input?.agent) && (
        <NoteLine>{`agent: ${str(input?.agent)}`}</NoteLine>
      )}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {str(input?.task)}
        </p>
      </div>
      {num(output?.turns) !== null && (
        <NoteLine>{`turns: ${num(output?.turns)}`}</NoteLine>
      )}
      {response && (
        <div className="rounded-xl border border-border bg-card p-3 text-sm">
          <MarkdownRenderer content={response} />
        </div>
      )}
    </>
  )
}

export function LoadSkillDetail({ input, output }: ToolDetailProps) {
  const instructions = str(output?.instructions)
  return (
    <>
      <PathRow path={`${str(input?.name)}  —  ${str(output?.base_dir)}`} />
      {instructions && (
        <div className="rounded-xl border border-border bg-card p-3 text-sm">
          <MarkdownRenderer content={instructions} />
        </div>
      )}
    </>
  )
}
