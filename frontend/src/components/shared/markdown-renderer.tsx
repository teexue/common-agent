import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { CopyButton } from "./copy-button"

function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const match = /language-(\w+)/.exec(className ?? "")
  const isInline = !match && !String(children).includes("\n")

  if (isInline) {
    return <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground ring-1 ring-border" {...props}>{children}</code>
  }

  const code = String(children).replace(/\n$/, "")
  return (
    <div className="group relative my-2 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5">
        <span className="font-mono text-[11px] font-medium text-muted-foreground">{match?.[1] ?? "code"}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3"><code className="font-mono text-[13px] leading-5" {...props}>{children}</code></pre>
    </div>
  )
}

const MD_COMPONENTS = {
  code: CodeBlock,
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  table: ({ children, ...p }: React.HTMLAttributes<HTMLTableElement> & { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto rounded-xl border border-border"><table className="w-full border-collapse text-sm" {...p}>{children}</table></div>
  ),
  th: ({ children, ...p }: React.HTMLAttributes<HTMLTableCellElement> & { children?: React.ReactNode }) => <th className="border-b border-border bg-muted/50 px-3 py-2 text-left font-semibold" {...p}>{children}</th>,
  td: ({ children, ...p }: React.HTMLAttributes<HTMLTableCellElement> & { children?: React.ReactNode }) => <td className="border-b border-border px-3 py-2" {...p}>{children}</td>,
  ul: ({ children, ...p }: React.HTMLAttributes<HTMLUListElement> & { children?: React.ReactNode }) => <ul className="list-disc pl-5 marker:text-muted-foreground/50" {...p}>{children}</ul>,
  ol: ({ children, ...p }: React.HTMLAttributes<HTMLOListElement> & { children?: React.ReactNode }) => <ol className="list-decimal pl-5 marker:text-muted-foreground/50" {...p}>{children}</ol>,
  li: ({ children, ...p }: React.HTMLAttributes<HTMLLIElement> & { children?: React.ReactNode }) => <li className="my-1" {...p}>{children}</li>,
  blockquote: ({ children, ...p }: React.HTMLAttributes<HTMLQuoteElement> & { children?: React.ReactNode }) => <blockquote className="border-l-2 border-primary/20 pl-3 text-muted-foreground italic" {...p}>{children}</blockquote>,
  a: ({ children, href, ...p }: React.HTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode; href?: string }) => <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary" {...p}>{children}</a>,
  hr: () => <hr className="my-4 border-border" />,
  p: ({ children, ...p }: React.HTMLAttributes<HTMLParagraphElement> & { children?: React.ReactNode }) => <p {...p}>{children}</p>,
  h1: ({ children, ...p }: React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) => <h1 className="mb-2 mt-4 font-heading text-lg tracking-tight text-foreground" {...p}>{children}</h1>,
  h2: ({ children, ...p }: React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) => <h2 className="mb-1.5 mt-3 font-heading text-base tracking-tight text-foreground" {...p}>{children}</h2>,
  h3: ({ children, ...p }: React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) => <h3 className="mb-1 mt-2.5 font-heading text-sm tracking-tight text-foreground" {...p}>{children}</h3>,
  strong: ({ children, ...p }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => <strong className="font-semibold text-foreground" {...p}>{children}</strong>,
}

export function MarkdownRenderer({ content, isStreaming = false }: { content: string; isStreaming?: boolean }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      <Markdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{content}</Markdown>
      {isStreaming && <span className="inline-block w-px h-[1em] animate-pulse bg-primary align-baseline" />}
    </div>
  )
}
