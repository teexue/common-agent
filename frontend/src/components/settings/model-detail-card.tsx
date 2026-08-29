import { useTranslation } from "react-i18next"
import { Info, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { ModelDetail } from "@/types/agent"
import { formatParameterSize, formatTokenCount } from "@/lib/format"

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {label}
      </span>
      <span className="text-right font-mono text-[11px] text-foreground">
        {value}
      </span>
    </div>
  )
}

function capabilityLabel(cap: string, t: (key: string) => string): string {
  const key = `settings.modelDetailCap_${cap}`
  const label = t(key)
  return label === key ? cap : label
}

function detailRows(
  detail: ModelDetail,
  t: (key: string) => string
): Array<{ label: string; value: string }> {
  const window = detail.context_window || detail.runtime_context_window
  const rows: Array<{ label: string; value: string }> = []
  if (window && window > 0) {
    rows.push({
      label: t("settings.modelDetailContext"),
      value: formatTokenCount(window),
    })
  }
  if (detail.parameter_size) {
    rows.push({
      label: t("settings.modelDetailParameterSize"),
      value: formatParameterSize(detail.parameter_size),
    })
  }
  if (detail.quantization) {
    rows.push({
      label: t("settings.modelDetailQuantization"),
      value: detail.quantization,
    })
  }
  if (detail.capabilities && detail.capabilities.length > 0) {
    rows.push({
      label: t("settings.modelDetailCapabilities"),
      value: detail.capabilities.map((c) => capabilityLabel(c, t)).join(", "),
    })
  }
  return rows
}

/** ModelDetailCard shows the few model facts a user needs: context size,
 * parameter size, quantization, and capabilities. Internal Ollama fields
 * (architecture, families, Modelfile num_ctx) are omitted. */
export function ModelDetailCard({
  detail,
  loading,
  err,
  empty,
  onRefresh,
}: {
  detail: ModelDetail | null
  loading: boolean
  err: string | null
  empty: boolean
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const rows = detail ? detailRows(detail, t) : []

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          {t("settings.modelDetailTitle")}
        </Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
          onClick={onRefresh}
          disabled={loading || empty}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {t("settings.modelDetailQuery")}
        </Button>
      </div>
      <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("settings.modelDetailLoading")}
          </div>
        ) : err ? (
          <p className="py-2 text-[11px] text-destructive">{err}</p>
        ) : empty ? (
          <p className="py-2 text-[11px] text-muted-foreground">
            {t("settings.modelDetailEmpty")}
          </p>
        ) : rows.length > 0 ? (
          <div className="divide-y divide-border/60">
            {rows.map((row) => (
              <DetailRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
