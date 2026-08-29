import { useTranslation } from "react-i18next"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isComposingEvent } from "@/lib/keys"

const SOURCES = ["http", "kanban", "optimize", "cli"] as const

interface RequestLogsFiltersProps {
  source: string
  onSourceChange: (value: string) => void
  sessionInput: string
  onSessionInput: (value: string) => void
  onApply: () => void
  onRefresh: () => void
}

function selectString(v: unknown): string | undefined {
  if (v && typeof v === "object" && "value" in v)
    return (v as { value: string }).value
  return undefined
}

function SourceSelect({
  source,
  onSourceChange,
}: Pick<RequestLogsFiltersProps, "source" | "onSourceChange">) {
  const { t } = useTranslation()
  const sourceOptions = [
    { value: "", label: t("audit.sourceAll") },
    ...SOURCES.map((s) => ({ value: s, label: s })),
  ]
  const selected =
    sourceOptions.find((o) => o.value === source) ?? sourceOptions[0]
  return (
    <Select
      value={selected}
      onValueChange={(v) => {
        const next = selectString(v)
        if (next !== undefined) onSourceChange(next)
      }}
    >
      <SelectTrigger className="h-8 w-32 rounded-xl text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {sourceOptions.map((o) => (
          <SelectItem key={o.value || "all"} value={o}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function RequestLogsFilters(props: RequestLogsFiltersProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2">
      <SourceSelect
        source={props.source}
        onSourceChange={props.onSourceChange}
      />
      <Input
        value={props.sessionInput}
        onChange={(e) => props.onSessionInput(e.target.value)}
        onKeyDown={(e) => {
          if (isComposingEvent(e)) return
          if (e.key === "Enter") props.onApply()
        }}
        placeholder={t("audit.filterSession")}
        className="h-8 w-48 rounded-xl font-mono text-xs"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={props.onApply}
      >
        {t("audit.applyFilter")}
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="h-8 w-8"
        onClick={props.onRefresh}
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
