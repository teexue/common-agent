import { str, num } from "@/components/inspector/tool-detail-utils"
import { diffLines, addedLines } from "@/components/inspector/diff-utils"
import {
  DiffBlock,
  FileContentBlock,
  FilePanel,
  Meta,
  type ToolRenderProps,
} from "./inline-tool-primitives"

function lineCount(s: string): number {
  return s === "" ? 0 : s.split("\n").length
}

export function ReadFile({ input, output }: ToolRenderProps) {
  const path = str(input?.path) || str(output?.path)
  const content = str(output?.content)
  const lines = lineCount(content)
  const truncated = output?.truncated === true
  const start = num(output?.offset) ?? num(input?.offset) ?? 1
  const startLine = start > 0 ? start : 1
  return (
    <FilePanel
      path={path}
      meta={
        <>
          {lines > 0 && <Meta>{`${lines} lines`}</Meta>}
          {startLine > 1 && <Meta>{`@${startLine}`}</Meta>}
          {truncated && <Meta tone="destructive">truncated</Meta>}
        </>
      }
    >
      {content && <FileContentBlock text={content} startLine={startLine} />}
    </FilePanel>
  )
}

export function WriteFile({ input }: ToolRenderProps) {
  const path = str(input?.path)
  const content = str(input?.content)
  const add = lineCount(content)
  return (
    <FilePanel path={path} meta={<Meta tone="success">{`+${add}`}</Meta>}>
      <DiffBlock lines={addedLines(content)} />
    </FilePanel>
  )
}

export function DeleteFile({ input, output }: ToolRenderProps) {
  const path = str(input?.path) || str(output?.path)
  return (
    <FilePanel path={path} meta={<Meta tone="destructive">deleted</Meta>}>
      {null}
    </FilePanel>
  )
}

export function EditFile({ input, output }: ToolRenderProps) {
  const path = str(input?.path) || str(output?.path)
  const replacements = num(output?.replacements)
  const lines = diffLines(str(input?.old_string), str(input?.new_string))
  const add = lines.filter((l) => l.type === "add").length
  const del = lines.filter((l) => l.type === "del").length
  return (
    <FilePanel
      path={path}
      meta={
        <>
          {replacements !== null && <Meta>{`${replacements}× `}</Meta>}
          {add > 0 && <Meta tone="success">{`+${add}`}</Meta>}
          {del > 0 && <Meta tone="destructive">{`-${del}`}</Meta>}
        </>
      }
    >
      <DiffBlock lines={lines} />
    </FilePanel>
  )
}
