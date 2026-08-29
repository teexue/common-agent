import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { KnowledgeHit } from "@/types/agent"

export function KnowledgeSearchSection({
  query,
  onQueryChange,
  busy,
  onSearch,
  hits,
}: {
  query: string
  onQueryChange: (value: string) => void
  busy: boolean
  onSearch: () => void
  hits: KnowledgeHit[]
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-[11px] font-medium text-muted-foreground">
        {t("manage.knowledgeTrySearch")}
      </p>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("manage.knowledgeSearchPlaceholder")}
          className="h-8 rounded-xl text-xs"
        />
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={busy || !query.trim()}
          onClick={onSearch}
        >
          <Search className="h-3.5 w-3.5" /> {t("manage.knowledgeSearch")}
        </Button>
      </div>
      {hits.map((h, i) => (
        <div
          key={`${h.doc_id}-${h.chunk_index}-${i}`}
          className="rounded-lg bg-muted/40 px-3 py-2"
        >
          <p className="text-[10px] text-muted-foreground">
            {h.filename} · score {h.score.toFixed(3)}
          </p>
          <p className="mt-1 text-xs whitespace-pre-wrap text-foreground">
            {h.text}
          </p>
        </div>
      ))}
    </div>
  )
}
