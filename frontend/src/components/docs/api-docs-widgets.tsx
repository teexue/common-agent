import { useTranslation } from "react-i18next"
import { Radio } from "lucide-react"
import { CopyButton } from "@/components/shared/copy-button"

export function BaseURLChip({ url }: { url: string }) {
  const { t } = useTranslation()
  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1">
      <span className="text-[11px] text-muted-foreground">
        {t("apiDocs.baseUrl")}
      </span>
      <code className="truncate font-mono text-[11px] text-foreground">
        {url}
      </code>
      <CopyButton
        text={url}
        className="h-5.5 w-5.5 rounded-md [&_svg]:size-3"
      />
    </div>
  )
}

export function FlowSteps() {
  const { t } = useTranslation()
  const steps = [
    t("apiDocs.flow1"),
    t("apiDocs.flow2"),
    t("apiDocs.flow3"),
    t("apiDocs.flow4"),
  ]
  return (
    <ol className="space-y-3">
      {steps.map((text, i) => (
        <li key={text} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[11px] font-medium text-primary">
            {i + 1}
          </span>
          <p className="max-w-2xl text-sm leading-relaxed text-foreground">
            {text}
          </p>
        </li>
      ))}
    </ol>
  )
}

export function EventList({
  items,
}: {
  items: { name: string; desc: string }[]
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.name} className="flex items-baseline gap-3">
          <Radio className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-primary" />
          <code className="w-44 shrink-0 font-mono text-[13px] text-foreground">
            {item.name}
          </code>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {item.desc}
          </p>
        </li>
      ))}
    </ul>
  )
}
