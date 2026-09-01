import { useState } from "react"
import { FileText } from "lucide-react"
import { ConstrainedImage } from "./constrained-image"
import { TextFileDialog } from "./text-file-dialog"
import type { ConversationEntry, FileAttachment } from "@/types/agent"

export function UserMessage({ entry }: { entry: ConversationEntry }) {
  const attachments = entry.attachments ?? []
  return (
    <div className="flex justify-end">
      <div className="flex max-w-[85%] flex-col items-end gap-1.5">
        {attachments.length > 0 && (
          <UserAttachments attachments={attachments} />
        )}
        {entry.content ? (
          <div className="rounded-2xl rounded-br-md bg-gradient-to-br from-accent via-primary/10 to-primary/25 px-3.5 py-2 shadow-md shadow-primary/15">
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
              {entry.content}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function UserAttachments({ attachments }: { attachments: FileAttachment[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {attachments.map((item, i) =>
        item.kind === "image" ? (
          <ConstrainedImage
            key={`${item.name}-${i}`}
            src={item.dataUrl}
            alt={item.name}
            minSide={100}
          />
        ) : (
          <UserTextFileChip
            key={`${item.name}-${i}`}
            name={item.name}
            text={item.text}
          />
        )
      )}
    </div>
  )
}

function UserTextFileChip({ name, text }: { name: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-left text-xs text-foreground hover:bg-muted"
      >
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{name}</span>
      </button>
      <TextFileDialog
        name={name}
        text={text}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
